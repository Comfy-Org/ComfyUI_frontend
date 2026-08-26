import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const astroConfig = readFileSync(
  new URL('../../astro.config.ts', import.meta.url),
  'utf8'
)
const supportedModelPage = readFileSync(
  new URL('../pages/p/supported-models/[slug].astro', import.meta.url),
  'utf8'
)

describe('canonical redirect destinations', () => {
  it('redirects the untranslated terms page directly to its canonical URL', () => {
    expect(astroConfig).toContain(
      "'/zh-CN/terms-of-service': '/terms-of-service/'"
    )
  })

  it('redirects model aliases directly to the canonical trailing-slash URL', () => {
    expect(supportedModelPage).toContain(
      'Astro.redirect(`/p/supported-models/${model.canonicalSlug}/`, 301)'
    )
  })
})
