import { execFileSync, spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Asset } from '@comfyorg/sdk/low'
import { afterEach, describe, expect, it } from 'vitest'

import { buildSnippet } from './models-snippets'
import type { SnippetFile } from './models-snippets'

const id = 'bfl/flux-2-pro'
const body = {
  prompt: 'A 🌻; $(exit 1) `exit 1`',
  nested: [true, null, { quote: '\\n' }]
}
const directories: string[] = []
const image = readFileSync(
  fileURLToPath(
    new URL('../../e2e/assets/placeholder-1x1.webp', import.meta.url)
  )
)

function directory() {
  const path = mkdtempSync(join(tmpdir(), 'models-sdk-snippets-'))
  directories.push(path)
  symlinkSync(
    fileURLToPath(new URL('../../node_modules', import.meta.url)),
    join(path, 'node_modules'),
    'dir'
  )
  return path
}

afterEach(() => {
  for (const path of directories.splice(0))
    rmSync(path, { recursive: true, force: true })
})

const asset: Asset = {
  id: 'asset-1',
  hash: null,
  size_bytes: 0,
  content_type: 'image/webp',
  created_at: '2026-09-13T00:00:00Z',
  url: 'https://storage.example/unused',
  url_expires_at: '2026-09-14T00:00:00Z'
}

const transport = `
const runs = [], uploads = []
globalThis.fetch = async (target, init = {}) => {
  const url = new URL(target)
  const headers = new Headers(init.headers)
  if (url.pathname.startsWith('/v2/models/')) {
    runs.push({ body: JSON.parse(init.body), key: headers.get('Idempotency-Key'), url: url.href })
    if (process.env.RETRY && runs.length === 1) return Response.json({ detail: 'Provider temporarily unavailable', error_type: 'provider_error' }, { status: 503, headers: { 'X-Comfy-Error-Type': 'provider_error' } })
    if (process.env.BINARY) return new Response(new Uint8Array([0, 255, 1]), { headers: { 'Content-Type': 'audio/mpeg' } })
    return Response.json({ images: [{ url: 'https://result.example/output.webp' }] }, { headers: { 'X-Comfy-Request-Id': 'request-1' } })
  }
  if (url.pathname.startsWith('/api/v2/assets/by-hash/')) return new Response(null, { status: 404 })
  if (url.pathname === '/api/v2/assets' && init.method === 'POST') {
    if (process.env.FAIL_UPLOAD) return Response.json({ error: 'forbidden' }, { status: 403 })
    const file = init.body.get('file')
    if (!(file instanceof Blob)) throw new Error('Missing SDK multipart file')
    uploads.push({ bytes: [...new Uint8Array(await file.arrayBuffer())], type: init.body.get('content_type'), path: init.body.get('file_path') })
    return Response.json({ ...${JSON.stringify(asset)}, id: 'asset-' + uploads.length, hash: init.body.get('expected_hash'), size_bytes: file.size, content_type: file.type }, { status: 201 })
  }
  if (url.pathname.endsWith('/content')) return new Response(null, { status: 302, headers: { Location: 'https://storage.example/' + url.pathname.split('/').at(-2) } })
  if (url.href === 'https://source.example/input.png') {
    if (headers.has('Authorization') || headers.has('X-API-Key')) throw new Error('Credential leaked to input host')
    return new Response(new Uint8Array([0, 42, 255]), { headers: { 'Content-Type': 'image/webp' } })
  }
  throw new Error('Unexpected network request: ' + url.href)
}
console.log = () => process.stdout.write(JSON.stringify({ runs, uploads }))
`

function execute(
  snippet: string,
  cwd = directory(),
  env: Record<string, string> = {}
) {
  return execFileSync(process.execPath, ['--input-type=module', '-'], {
    cwd,
    input: transport + snippet,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 8000,
    env: { PATH: process.env.PATH, COMFY_API_KEY: 'test-key', ...env }
  })
}

describe('SDK snippets', () => {
  it('uses embedded media bytes directly and through SDK assets without requiring a local file', () => {
    const sourceDataUrl = 'data:image/webp;base64,' + image.toString('base64')
    const files: SnippetFile[] = [
      {
        token: 'inline',
        name: 'image.webp',
        mimeType: 'image/webp',
        sourceDataUrl
      },
      {
        token: 'upload',
        name: 'mask.webp',
        mimeType: 'image/webp',
        sourceDataUrl,
        encoding: 'url'
      }
    ]
    const result = JSON.parse(
      execute(
        buildSnippet(
          'typescript',
          id,
          {
            inline: 'data:image/webp;base64,inline',
            image: 'upload'
          },
          { files }
        )
      )
    )
    expect(result.runs[0].body).toEqual({
      inline: sourceDataUrl,
      image: 'https://storage.example/asset-1'
    })
    expect(result.uploads).toEqual([
      { path: 'mask.webp', bytes: [...image], type: 'image/webp' }
    ])
  })

  it('executes through the released SDK, preserving native JSON and minting a fresh key per execution', () => {
    const snippet = buildSnippet('typescript', id, body)
    const first = JSON.parse(execute(snippet))
    const second = JSON.parse(execute(snippet))
    expect(first.runs[0].body).toEqual(body)
    expect(first.runs[0].url).toBe(
      'https://stagingapi.comfy.org/v2/models/' + id
    )
    expect(first.runs[0].key).toMatch(/^[\da-f-]{36}$/i)
    expect(second.runs[0].key).not.toBe(first.runs[0].key)
    const retry = JSON.parse(execute(snippet, directory(), { RETRY: '1' }))
    expect(retry.runs).toHaveLength(2)
    expect(retry.runs[1]).toEqual(retry.runs[0])
  })

  it('uploads URL-capable inputs through SDK assets, retaining bytes and deriving inline MIME from the supplied path', () => {
    const cwd = directory()
    const files: SnippetFile[] = [
      {
        token: 'first',
        name: 'first.webp',
        mimeType: 'image/webp',
        encoding: 'base64',
        urlAlternative: true
      },
      {
        token: 'https://upload.invalid/second',
        name: 'second.webp',
        mimeType: 'image/webp',
        encoding: 'url'
      },
      {
        token: 'third',
        name: 'third.webp',
        mimeType: 'image/png',
        encoding: 'base64'
      }
    ]
    for (const file of files) writeFileSync(join(cwd, file.name), image)
    const payload = {
      image: ['data:image/webp;base64,first', files[1].token],
      nested: { data: 'third', mimeType: 'image/png' },
      prompt: body.prompt
    }
    const snippet = buildSnippet('typescript', id, payload, { files })
    const result = JSON.parse(execute(snippet, cwd))
    expect(result.runs[0].body).toEqual({
      image: [
        'https://storage.example/asset-1',
        'https://storage.example/asset-2'
      ],
      nested: { data: image.toString('base64'), mimeType: 'image/webp' },
      prompt: body.prompt
    })
    expect(result.uploads).toEqual([
      { path: 'first.webp', bytes: [...image], type: 'image/webp' },
      { path: 'second.webp', bytes: [...image], type: 'image/webp' }
    ])
    const failed = spawnSync(process.execPath, ['--input-type=module', '-'], {
      cwd,
      input: transport + snippet,
      encoding: 'utf8',
      timeout: 8000,
      env: {
        PATH: process.env.PATH,
        COMFY_API_KEY: 'test-key',
        FAIL_UPLOAD: '1'
      }
    })
    expect(failed.status).not.toBe(0)
    expect(failed.stdout).toBe('')
    expect(failed.stderr).not.toContain('test-key')
  })

  it('keeps default reference URLs runnable without local files and downloads only native inline inputs', () => {
    const files: SnippetFile[] = [
      {
        token: 'reference',
        name: 'absent.webp',
        mimeType: 'image/webp',
        sourceUrl: 'https://source.example/reference.webp',
        urlAlternative: true
      },
      {
        token: 'inline',
        name: 'input.png',
        mimeType: 'image/png',
        sourceUrl: 'https://source.example/input.png'
      }
    ]
    const snippet = buildSnippet(
      'typescript',
      id,
      {
        image: 'data:image/webp;base64,reference',
        inline: { data: 'inline', mimeType: 'image/png' }
      },
      { files }
    )
    const result = JSON.parse(execute(snippet))
    expect(result.runs[0].body).toEqual({
      image: 'https://source.example/reference.webp',
      inline: {
        data: Buffer.from([0, 42, 255]).toString('base64'),
        mimeType: 'image/webp'
      }
    })
    expect(result.uploads).toEqual([])
  })

  it('rehosts a default URL through SDK assets when the native mapping requires a new URL', () => {
    const files: SnippetFile[] = [
      {
        token: 'url',
        name: 'input.png',
        mimeType: 'image/png',
        encoding: 'url',
        sourceUrl: 'https://source.example/input.png',
        rehost: true
      }
    ]
    const result = JSON.parse(
      execute(buildSnippet('typescript', id, { image: 'url' }, { files }))
    )
    expect(result.runs[0].body).toEqual({
      image: 'https://storage.example/asset-1'
    })
    expect(result.uploads[0]).toMatchObject({
      bytes: [0, 42, 255],
      type: 'image/webp'
    })
  })

  it('fails on a missing key before accessing local inputs or sending requests', () => {
    const files: SnippetFile[] = [
      {
        token: 'image',
        name: 'missing.png',
        mimeType: 'image/png',
        encoding: 'url'
      }
    ]
    expect(() =>
      execute(
        buildSnippet('typescript', id, { image: 'image' }, { files }),
        directory(),
        { COMFY_API_KEY: '  ' }
      )
    ).toThrow('Set COMFY_API_KEY')
  })

  it('preserves binary output for endpoints unsupported by models.run', () => {
    const cwd = directory()
    const snippet = buildSnippet(
      'typescript',
      'elevenlabs/eleven_v3',
      { text: 'Hello' },
      { output: 'binary' }
    )
    expect(snippet).not.toContain('npm install')
    execute(snippet, cwd, { BINARY: '1' })
    expect(readFileSync(join(cwd, 'output.bin'))).toEqual(
      Buffer.from([0, 255, 1])
    )
  })

  it('renders valid Python literals and passes the exact native arguments to the asynchronous SDK call', () => {
    const snippet = buildSnippet('python', id, body)
    const parsed = execFileSync(
      'python3',
      [
        '-c',
        'import ast,json,sys\nm=ast.parse(sys.stdin.read())\na=next(n for n in ast.walk(m) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=="parameters" for t in n.targets))\nc=next(n for n in ast.walk(m) if isinstance(n,ast.Await) and isinstance(n.value,ast.Call) and isinstance(n.value.func,ast.Attribute) and n.value.func.attr=="run")\nprint(json.dumps([ast.literal_eval(a.value),ast.literal_eval(c.value.args[0]),c.value.args[1].id]))'
      ],
      { input: snippet, encoding: 'utf8' }
    )
    expect(JSON.parse(parsed)).toEqual([body, id, 'parameters'])
  })
})
