import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { buildSnippet } from './models-snippets'
import type { SnippetFile } from './models-snippets'

const id = 'bfl/flux-2-pro'
const key = 'one-intent-one-key'
const body = {
  prompt:
    "It's a 🌻; $(exit 1) " +
    String.fromCharCode(96) +
    'exit 1' +
    String.fromCharCode(96),
  prompt_upsampling: false,
  nested: [true, null, { quote: '\\n' }]
}

describe('buildSnippet', () => {
  it('round-trips the exact Python request body without confusing JSON and Python literals', () => {
    const snippet = buildSnippet('python', id, body, key)
    const result = execFileSync(
      'python3',
      [
        '-c',
        'import ast,json,sys\nm=ast.parse(sys.stdin.read())\nc=next(n for n in ast.walk(m) if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and n.func.attr=="loads")\nprint(json.dumps(json.loads(ast.literal_eval(c.args[0]))))'
      ],
      { input: snippet, encoding: 'utf8' }
    )
    expect(JSON.parse(result)).toEqual(body)
    expect(snippet).toContain(key)
    expect(snippet).toContain('timeout=660')
  })

  it('sends the exact cURL payload and a stable nonempty key on repeated execution', () => {
    const snippet = buildSnippet('curl', id, body, key)
    const capture = 'curl() { printf \'%s\\0\' "$@"; }\n'
    for (let attempt = 0; attempt < 2; attempt++) {
      const args = execFileSync('bash', ['-c', capture + snippet], {
        encoding: 'utf8'
      }).split('\0')
      expect(JSON.parse(args[args.indexOf('--data') + 1])).toEqual(body)
      expect(args).toContain('Idempotency-Key: ' + key)
      expect(args).toContain('https://stagingapi.comfy.org/v2/models/' + id)
    }
  })

  it('executes TypeScript with the same body and no invented model or output envelope', () => {
    const snippet = buildSnippet('typescript', id, body, key)
    const capture =
      'globalThis.fetch = async (url, init) => { process.stdout.write(init.body); return Response.json({}) }; console.log=()=>{};\n'
    const result = execFileSync(
      process.execPath,
      ['--input-type=module', '-'],
      {
        input: capture + snippet,
        encoding: 'utf8',
        env: { COMFY_API_KEY: 'test-key', PATH: process.env.PATH }
      }
    )
    expect(JSON.parse(result)).toEqual(body)
    expect(snippet).toContain(key)
  })
})

describe('local files in snippets', () => {
  const temporaryDirectories: string[] = []
  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0))
      rmSync(directory, { recursive: true, force: true })
  })
  const files: SnippetFile[] = [
    { token: 'file-token-1', name: 'input.png', mimeType: 'image/png' },
    { token: 'file-token-2', name: 'input.png', mimeType: 'image/jpeg' }
  ]
  const bytes = [Buffer.from([0, 255, 34, 92]), Buffer.from([255, 0, 13, 10])]
  const payload = {
    ...body,
    unchanged: bytes[0].toString('base64'),
    input_image: files[0].token,
    contents: [
      {
        role: 'user',
        parts: [
          { text: body.prompt },
          { inlineData: { data: files[0].token, mimeType: 'image/png' } }
        ]
      }
    ],
    content: [
      { type: 'text', text: body.prompt },
      {
        type: 'image_url',
        role: 'first_frame',
        image_url: { url: `data:image/jpeg;base64,${files[1].token}` }
      }
    ],
    instances: [
      {
        prompt: body.prompt,
        image: { bytesBase64Encoded: files[0].token, mimeType: 'image/png' }
      }
    ]
  }

  it.for(['python', 'typescript'] as const)(
    '%s reads distinct local files and reproduces the native body, including raw Base64 and data URLs',
    (language) => {
      const directory = mkdtempSync(join(tmpdir(), 'models-snippets-'))
      temporaryDirectories.push(directory)
      writeFileSync(join(directory, 'input_1-input.png'), bytes[0])
      writeFileSync(join(directory, 'input_2-input.png'), bytes[1])
      const snippet = buildSnippet(language, id, payload, key, files)
      const capture =
        language === 'python'
          ? 'import json,sys,types\ndef post(url, **kwargs):\n print(json.dumps(kwargs["json"]))\n raise SystemExit(0)\nsys.modules["requests"]=types.SimpleNamespace(post=post)\n'
          : 'globalThis.fetch = async (url, init) => { process.stdout.write(init.body); return Response.json({}) }; console.log=()=>{};\n'
      const result = execFileSync(
        language === 'python' ? 'python3' : process.execPath,
        language === 'python' ? ['-'] : ['--input-type=module', '-'],
        {
          cwd: directory,
          input: capture + snippet,
          encoding: 'utf8',
          env: { COMFY_API_KEY: 'test-key', PATH: process.env.PATH }
        }
      )
      const expected = JSON.parse(
        JSON.stringify(payload)
          .replaceAll(files[0].token, bytes[0].toString('base64'))
          .replaceAll(files[1].token, bytes[1].toString('base64'))
      )
      expect(JSON.parse(result)).toEqual(expected)
      expect(snippet).not.toContain(files[0].token)
      expect(snippet).not.toContain(files[1].token)
      expect(snippet).toContain(key)
    }
  )

  it('removes whole nested image parts from cURL, preserves ordinary fields and URLs, and copies the warning', () => {
    const snippet = buildSnippet(
      'curl',
      id,
      {
        ...payload,
        source_url: 'https://example.com/image.png',
        images: [files[0].token, files[1].token],
        empty: []
      },
      key,
      files
    )
    const args = execFileSync(
      'bash',
      ['-c', 'curl() { printf \'%s\\0\' "$@"; }\n' + snippet],
      {
        encoding: 'utf8'
      }
    ).split('\0')
    expect(JSON.parse(args[args.indexOf('--data') + 1])).toEqual({
      ...body,
      unchanged: bytes[0].toString('base64'),
      contents: [{ role: 'user', parts: [{ text: body.prompt }] }],
      content: [{ type: 'text', text: body.prompt }],
      instances: [{ prompt: body.prompt }],
      source_url: 'https://example.com/image.png',
      empty: []
    })
    expect(snippet).not.toContain(files[0].token)
    expect(snippet).not.toContain('base64,')
    expect(snippet).toContain('This request may be incomplete')
  })

  it('keeps a root-level model type when the uploaded image is its only other input', () => {
    const snippet = buildSnippet(
      'curl',
      id,
      {
        type: 'image-edit',
        input_image: files[0].token
      },
      key,
      files
    )
    const args = execFileSync(
      'bash',
      ['-c', 'curl() { printf \'%s\\0\' "$@"; }\n' + snippet],
      {
        encoding: 'utf8'
      }
    ).split('\0')
    expect(JSON.parse(args[args.indexOf('--data') + 1])).toEqual({
      type: 'image-edit'
    })
  })
})
