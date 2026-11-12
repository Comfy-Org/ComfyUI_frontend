import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

function hasStringImports(
  value: unknown
): value is { imports: Record<string, string> } {
  if (typeof value !== 'object' || value === null || !('imports' in value)) {
    return false
  }
  const { imports } = value
  return (
    typeof imports === 'object' &&
    imports !== null &&
    Object.values(imports).every((entry) => typeof entry === 'string')
  )
}

describe('node API entry point', () => {
  it.for([
    {
      behavior: 'exports the installed host singleton by identity',
      script: `
import assert from 'node:assert/strict'
const installed = Object.freeze({ registry: new Map() })
globalThis.comfy = installed
const { comfy } = await import(process.argv[1])
assert.strictEqual(comfy, installed)
`
    },
    {
      behavior: 'rejects importing before the host installs the API',
      script: `
import assert from 'node:assert/strict'
await assert.rejects(import(process.argv[1]), {
  name: 'Error',
  message: /imported before the host installed the API/
})
`
    }
  ])('$behavior', ({ script }) => {
    const moduleUrl = pathToFileURL(resolve('public/comfy/api/v2.js')).href
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', script, moduleUrl],
      { encoding: 'utf8', timeout: 10_000 }
    )

    expect(result.error).toBeUndefined()
    expect({ status: result.status, stderr: result.stderr }).toEqual({
      status: 0,
      stderr: ''
    })
  })

  it('maps the stable import to the configured frontend base path', () => {
    const html = readFileSync('index.html', 'utf8')
    const importMapSource = html.match(
      /<script type="importmap">\s*([\s\S]*?)\s*<\/script>/
    )?.[1]
    if (!importMapSource)
      throw new Error('Expected an import map in index.html')

    const importMap: unknown = JSON.parse(
      importMapSource.replaceAll('%BASE_URL%', '/ComfyUI/')
    )
    if (!hasStringImports(importMap)) {
      throw new Error('Expected an import map with string entries')
    }

    expect(importMap.imports['/comfy/api/v2.js']).toBe(
      '/ComfyUI/comfy/api/v2.js'
    )
  })
})
