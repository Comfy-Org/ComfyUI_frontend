import { describe, expect, it } from 'vitest'

import type { TranslationKey } from '../../i18n/translations'

import { getRoutes } from '../../config/routes'
import { hasKey, t, translationKeys } from '../../i18n/translations'
import { dropItems, resolveCtaHref } from './dropItems'

const PREFIX = 'drops-landing'

const EXPECTED_SECTION_PREFIXES = [
  'page',
  'hero',
  'moreDrops',
  'item',
  'getStarted',
  'fresh',
  'footerCta'
] as const

const STEP_COUNT = 3
const FRESH_CARD_COUNT = 2

const INTERNAL_KEY_PATTERNS = [
  /open-questions/,
  /todo/i,
  /draft/i,
  /placeholder/i,
  /internal/i
]

function dropsKeys(): string[] {
  return translationKeys.filter((k) => k.startsWith(`${PREFIX}.`))
}

describe('drops landing i18n', () => {
  it('exposes the canonical top-level section prefixes', () => {
    const keys = dropsKeys()
    for (const section of EXPECTED_SECTION_PREFIXES) {
      const hit = keys.some((k) => k.startsWith(`${PREFIX}.${section}.`))
      expect(hit, `missing section: ${section}`).toBe(true)
    }
  })

  it('exposes page, hero, and section headings', () => {
    expect(hasKey(`${PREFIX}.page.title`)).toBe(true)
    expect(hasKey(`${PREFIX}.page.description`)).toBe(true)
    expect(hasKey(`${PREFIX}.hero.eyebrow`)).toBe(true)
    expect(hasKey(`${PREFIX}.hero.headingAccent`)).toBe(true)
    expect(hasKey(`${PREFIX}.hero.body1`)).toBe(true)
    expect(hasKey(`${PREFIX}.hero.body2`)).toBe(true)
    expect(hasKey(`${PREFIX}.hero.primaryCta`)).toBe(true)
    expect(hasKey(`${PREFIX}.hero.secondaryCta`)).toBe(true)
    expect(hasKey(`${PREFIX}.moreDrops.eyebrow`)).toBe(true)
    expect(hasKey(`${PREFIX}.moreDrops.headingAccent`)).toBe(true)
    expect(hasKey(`${PREFIX}.getStarted.eyebrow`)).toBe(true)
    expect(hasKey(`${PREFIX}.getStarted.headingAccent`)).toBe(true)
    expect(hasKey(`${PREFIX}.fresh.eyebrow`)).toBe(true)
    expect(hasKey(`${PREFIX}.fresh.headingAccent`)).toBe(true)
    expect(hasKey(`${PREFIX}.footerCta.line1`)).toBe(true)
    expect(hasKey(`${PREFIX}.footerCta.line2`)).toBe(true)
  })

  it('matches every drop item to title, tagline, and body translation keys', () => {
    for (const item of dropItems) {
      expect(hasKey(item.titleKey)).toBe(true)
      expect(hasKey(item.taglineKey)).toBe(true)
      expect(hasKey(item.bodyKey)).toBe(true)
    }
  })

  it('matches every CTA label to a translation key', () => {
    for (const item of dropItems) {
      if (!item.cta) continue
      expect(hasKey(item.cta.labelKey)).toBe(true)
    }
  })

  it('exposes the get-started step copy', () => {
    for (let n = 1; n <= STEP_COUNT; n++) {
      expect(hasKey(`${PREFIX}.getStarted.step.${n}.title`)).toBe(true)
      expect(hasKey(`${PREFIX}.getStarted.step.${n}.body`)).toBe(true)
    }
  })

  it('exposes the fresh-from-comfy-create card copy', () => {
    for (let n = 1; n <= FRESH_CARD_COUNT; n++) {
      expect(hasKey(`${PREFIX}.fresh.card${n}.title`)).toBe(true)
      expect(hasKey(`${PREFIX}.fresh.card${n}.body`)).toBe(true)
      expect(hasKey(`${PREFIX}.fresh.card${n}.cta`)).toBe(true)
    }
  })

  it('returns non-empty english copy for every drops-landing key', () => {
    for (const key of dropsKeys()) {
      expect(t(key as TranslationKey, 'en').trim().length).toBeGreaterThan(0)
    }
  })

  it('does not leak internal-only keys (drafts, todos, open questions)', () => {
    const leaks = dropsKeys().filter((k) =>
      INTERNAL_KEY_PATTERNS.some((re) => re.test(k))
    )
    expect(leaks).toEqual([])
  })

  it('uses unique drop item ids', () => {
    const ids = dropItems.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has a non-empty image url and resolvable href for every drop item with a CTA', () => {
    const routes = getRoutes('en')
    for (const item of dropItems) {
      expect(item.imageUrl.length).toBeGreaterThan(0)
      if (!item.cta) continue
      expect(resolveCtaHref(item.cta, routes).length).toBeGreaterThan(0)
    }
  })

  it('resolves internal CTA hrefs through the locale-aware route helper', () => {
    const internalCtas = dropItems
      .map((item) => item.cta)
      .filter(
        (cta): cta is NonNullable<typeof cta> & { external: false } =>
          cta !== undefined && !cta.external
      )
    expect(internalCtas.length).toBeGreaterThan(0)
    const enRoutes = getRoutes('en')
    const zhRoutes = getRoutes('zh-CN')
    for (const cta of internalCtas) {
      expect(resolveCtaHref(cta, enRoutes)).toBe(enRoutes[cta.routeKey])
      expect(resolveCtaHref(cta, zhRoutes)).toBe(zhRoutes[cta.routeKey])
    }
  })

  it('preserves external CTA hrefs regardless of locale', () => {
    const externalCtas = dropItems
      .map((item) => item.cta)
      .filter(
        (cta): cta is NonNullable<typeof cta> & { external: true } =>
          cta !== undefined && cta.external
      )
    expect(externalCtas.length).toBeGreaterThan(0)
    const enRoutes = getRoutes('en')
    const zhRoutes = getRoutes('zh-CN')
    for (const cta of externalCtas) {
      expect(resolveCtaHref(cta, enRoutes)).toBe(cta.url)
      expect(resolveCtaHref(cta, zhRoutes)).toBe(cta.url)
    }
  })

  it('omits the CTA button for items without a CTA (e.g. oss-vram pending blog post)', () => {
    const itemsWithoutCta = dropItems.filter((item) => !item.cta)
    expect(itemsWithoutCta.map((item) => item.id)).toContain('oss-vram')
  })
})
