import { describe, expect, it } from 'vitest'

import { loadRouterSvgRasterizerModule } from './router-model-svg'

describe('router SVG rasterizer loader', () => {
  it('serves the package-owned rasterizer as one self-contained module', async () => {
    const url = await loadRouterSvgRasterizerModule()
    expect(url).toMatch(/^data:text\/javascript;base64,/)
    const source = Buffer.from(
      url.slice(url.indexOf(',') + 1),
      'base64'
    ).toString('utf8')
    expect(source).toContain('export async function rasterizeSvgImage')
    expect(source).not.toMatch(/^import /m)
  })
})
