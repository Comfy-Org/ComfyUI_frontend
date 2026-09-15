import { describe, expect, it } from 'vitest'

import { workshopModels } from '../../config/workshop-browse-content'
import { GET } from './catalogue.md'

function render(site?: URL): Response {
  return GET({ site } as unknown as Parameters<typeof GET>[0]) as Response
}

describe('GET', () => {
  it('renders the public catalogue, not the gated loading frame', async () => {
    const body = await render().text()
    expect(body).not.toMatch(/^Loading$/m)
    expect(body).toContain('# Models in ComfyUI')
    for (const model of workshopModels.slice(0, 3))
      expect(body).toContain(`[${model.name}](${model.href})`)
  })

  it('lists every catalogue model', async () => {
    const body = await render().text()
    for (const model of workshopModels) expect(body).toContain(model.href)
  })

  it('resolves links and the canonical against the site origin', async () => {
    const body = await render(new URL('https://comfy.org')).text()
    expect(body).toContain('canonical: https://comfy.org/models/')
    expect(body).toContain('index: https://comfy.org/llms.txt')
  })
})
