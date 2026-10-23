import { describe, expect, it } from 'vitest'

import { localModels } from '@/config/local-models'
import { models } from '@/config/models'
import { GET } from './llms.txt'

function render(site?: URL) {
  return GET({ site } as unknown as Parameters<typeof GET>[0]) as Response
}

describe('llms.txt catalog', () => {
  it('serves plain text with a markdown-twin link per model file', async () => {
    const res = render(new URL('https://example.org'))
    expect(res.headers.get('Content-Type')).toContain('text/plain')
    const body = await res.text()
    expect(
      localModels
        .map(
          (model) =>
            `[${model.displayName}](https://example.org/hub/models/local/${model.slug}.md)`
        )
        .filter((link) => !body.includes(link))
    ).toEqual([])
  })

  it('excludes alias entries and partner pages, which redirect elsewhere', async () => {
    const body = await render().text()
    expect(
      models
        .filter((m) => m.canonicalSlug || m.directory === 'partner_nodes')
        .map((model) => `/hub/models/local/${model.slug}.md`)
        .filter((link) => body.includes(link))
    ).toEqual([])
  })

  it('lists launch pages as HTML pages, never as markdown twins', async () => {
    const body = await render().text()
    const launchSection = body.split('## Latest model launches')[1] ?? ''
    const launchLines = launchSection
      .split('## Run them')[0]
      .split('\n')
      .filter((line) => line.startsWith('- '))
    expect(launchLines.length).toBeGreaterThan(0)
    expect(launchLines.filter((line) => !line.includes('launch page'))).toEqual(
      []
    )
    expect(launchLines.filter((line) => line.includes('.md'))).toEqual([])
    expect(body).toContain('without twins')
  })

  it('falls back to comfy.org when no site is configured', async () => {
    const body = await render().text()
    expect(body).toContain('https://comfy.org/hub/models/local/')
  })
})
