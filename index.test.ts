import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('node API entry point', () => {
  it('maps the stable import to the configured frontend base path', () => {
    const html = readFileSync('index.html', 'utf8')
    const importMapSource = html.match(
      /<script type="importmap">\s*([\s\S]*?)\s*<\/script>/
    )?.[1]
    if (!importMapSource)
      throw new Error('Expected an import map in index.html')

    const importMap = JSON.parse(
      importMapSource.replaceAll('%BASE_URL%', '/ComfyUI/')
    ) as { imports?: Record<string, string> }

    expect(importMap.imports?.['/comfy/api/v2.js']).toBe(
      '/ComfyUI/comfy/api/v2.js'
    )
  })
})
