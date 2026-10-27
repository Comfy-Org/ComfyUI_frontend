import { readFileSync } from 'node:fs'

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
