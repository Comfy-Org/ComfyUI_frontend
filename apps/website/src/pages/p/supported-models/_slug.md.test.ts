import { describe, expect, it } from 'vitest'

import { PRICING_URL } from '../../../config/model-pricing'
import { models } from '../../../config/models'
import { GET, getStaticPaths } from './[slug].md'

type Model = (typeof models)[number]

function mustFind(predicate: (model: Model) => boolean): Model {
  const model = models.find(predicate)
  if (!model) throw new Error('fixture model missing from registry data')
  return model
}

const partner = mustFind(
  (m) => m.directory === 'partner_nodes' && !m.canonicalSlug
)
const open = mustFind(
  (m) => m.directory !== 'partner_nodes' && !m.canonicalSlug
)

function render(model: Model, site?: URL) {
  return GET({ props: { model }, site } as unknown as Parameters<
    typeof GET
  >[0]) as Response
}

describe('getStaticPaths', () => {
  it('generates a path per model and skips 301 aliases', () => {
    const slugs = new Set(getStaticPaths().map((p) => p.params.slug))
    expect(slugs.has(partner.slug)).toBe(true)
    expect(slugs.has(open.slug)).toBe(true)
    for (const alias of models.filter((m) => m.canonicalSlug)) {
      expect(slugs.has(alias.slug)).toBe(false)
    }
  })
})

describe('GET', () => {
  it('serves markdown with the model heading on the site origin', async () => {
    const res = render(open, new URL('https://example.org'))
    expect(res.headers.get('Content-Type')).toContain('text/markdown')
    const body = await res.text()
    expect(body).toContain(`# ${open.displayName} in ComfyUI`)
    expect(body).toContain(
      `https://example.org/p/supported-models/${open.slug}`
    )
  })

  it('leads with front matter and ends with the agent run paths', async () => {
    const body = await render(open, new URL('https://example.org')).text()
    expect(body.startsWith('---\ntitle: "')).toBe(true)
    expect(body).toContain(
      `canonical: https://example.org/p/supported-models/${open.slug}\nlang: en\nindex: https://example.org/llms.txt\n---`
    )
    expect(body).toContain('https://docs.comfy.org/agent-tools/cli.md')
    expect(body).toContain('https://cloud.comfy.org/mcp')
  })

  it('falls back to comfy.org when no site is configured', async () => {
    const body = await render(open).text()
    expect(body).toContain(`https://comfy.org/p/supported-models/${open.slug}`)
  })

  it('gives partner models the provider-API run path and pricing section', async () => {
    const body = await render(partner).text()
    expect(body).toContain('through partner nodes')
    expect(body).not.toContain('Locally in ComfyUI')
    expect(body).toContain(PRICING_URL)
    expect(body).not.toContain('#cloud-gpu')
  })

  it('gives open models the local run path and Cloud GPU pricing', async () => {
    const body = await render(open).text()
    expect(body).toContain('Locally in ComfyUI')
    expect(body).toContain(`${PRICING_URL}#cloud-gpu`)
  })
})
