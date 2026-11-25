import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build, createServer } from 'vite'
import type { InlineConfig } from 'vite'
import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'

import { publishedNodeApiPlugin } from './publishedNodeApiPlugin'

const REPOSITORY_ROOT = fileURLToPath(new URL('../..', import.meta.url))

function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'published-node-api-'))
  onTestFinished(() => rmSync(directory, { recursive: true, force: true }))
  return directory
}

function emptyProjectRoot() {
  const root = temporaryDirectory()
  writeFileSync(join(root, 'index.html'), '<!doctype html><html></html>')
  return root
}

async function builtFiles(config: InlineConfig) {
  const result = await build({
    ...config,
    configFile: false,
    logLevel: 'silent',
    build: { write: false }
  })
  assert(
    !Array.isArray(result) && 'output' in result,
    'one build with its output in memory'
  )
  return result.output
}

function assetSource(
  files: Awaited<ReturnType<typeof builtFiles>>,
  fileName: string
) {
  const file = files.find((one) => one.fileName === fileName)
  return file?.type === 'asset' ? String(file.source) : undefined
}

async function builtModule() {
  return assetSource(
    await builtFiles({
      root: emptyProjectRoot(),
      plugins: [publishedNodeApiPlugin()]
    }),
    'comfy/api/v4.js'
  )
}

async function servedModule() {
  const server = await createServer({
    configFile: false,
    root: REPOSITORY_ROOT,
    logLevel: 'silent',
    plugins: [publishedNodeApiPlugin()],
    server: { middlewareMode: true, ws: false }
  })
  onTestFinished(() => server.close())
  return (await server.transformRequest('/comfy/api/v4.js'))?.code
}

function importSource(code: string | undefined) {
  const file = join(temporaryDirectory(), 'v4.js')
  writeFileSync(file, code ?? '')
  return import(pathToFileURL(file).href)
}

describe.for([
  { name: 'built', publishedModule: builtModule },
  { name: 'served in development', publishedModule: servedModule }
])('the $name /comfy/api/v4.js', ({ publishedModule }) => {
  it('exports the API the host installed, not a copy of it', async () => {
    const installed = Object.freeze({})
    vi.stubGlobal('window', { comfy_v4: installed })

    const { comfy } = await importSource(await publishedModule())

    expect(comfy).toBe(installed)
  })

  it('refuses to load before the host has installed the API', async () => {
    vi.stubGlobal('window', {})

    await expect(importSource(await publishedModule())).rejects.toThrow(
      /has no API to export/
    )
  })
})

describe('index.html', () => {
  it('maps /comfy/api/v4.js to the path the frontend is served from', () => {
    const source = readFileSync(
      join(REPOSITORY_ROOT, 'index.html'),
      'utf8'
    ).match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1]

    expect(
      JSON.parse((source ?? '{}').replaceAll('%BASE_URL%', '/ComfyUI/'))
    ).toMatchObject({
      imports: { '/comfy/api/v4.js': '/ComfyUI/comfy/api/v4.js' }
    })
  })
})
