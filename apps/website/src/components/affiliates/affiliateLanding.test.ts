import { describe, expect, it } from 'vitest'

import { hasKey, t, translationKeys } from '../../i18n/translations'
import {
  AFFILIATE_FAQ_COUNT,
  AFFILIATE_FAQ_HEADING_KEY,
  AFFILIATE_FAQ_PREFIX
} from './affiliateFaqs'
import { brandAssets } from './brandAssets'

const PREFIX = 'affiliate-landing'

const EXPECTED_SECTION_PREFIXES = [
  'page',
  'cta',
  'hero',
  'trust',
  'how',
  'audience',
  'details',
  'assets',
  'faq',
  'footerCta'
] as const

const HERO_HIGHLIGHT_COUNT = 4
const HOW_STEP_COUNT = 3
const AUDIENCE_ITEM_COUNT = 5
const DETAILS_ROW_COUNT = 6

const INTERNAL_KEY_PATTERNS = [
  /open-questions/,
  /todo/i,
  /draft/i,
  /placeholder/i,
  /internal/i
]

function affiliateKeys(): string[] {
  return translationKeys.filter((k) => k.startsWith(`${PREFIX}.`))
}

describe('affiliate landing i18n', () => {
  it('exposes the canonical top-level section prefixes', () => {
    const keys = affiliateKeys()
    for (const section of EXPECTED_SECTION_PREFIXES) {
      const hit = keys.some((k) => k.startsWith(`${PREFIX}.${section}.`))
      expect(hit, `missing section: ${section}`).toBe(true)
    }
  })

  it('orders sections as the page renders them', () => {
    const keys = affiliateKeys()
    const seenSections: string[] = []
    for (const key of keys) {
      const section = key.split('.')[1]
      if (!section) continue
      if (!seenSections.includes(section)) seenSections.push(section)
    }
    const orderedExpected = EXPECTED_SECTION_PREFIXES.filter((s) =>
      seenSections.includes(s)
    )
    const orderedActual = seenSections.filter((s) =>
      (EXPECTED_SECTION_PREFIXES as readonly string[]).includes(s)
    )
    expect(orderedActual).toEqual([...orderedExpected])
  })

  it('exposes hero, page, and cta keys editors will need', () => {
    expect(hasKey(`${PREFIX}.page.title`)).toBe(true)
    expect(hasKey(`${PREFIX}.page.description`)).toBe(true)
    expect(hasKey(`${PREFIX}.cta.apply`)).toBe(true)
    expect(hasKey(`${PREFIX}.cta.applyAriaLabel`)).toBe(true)
    expect(hasKey(`${PREFIX}.hero.heading`)).toBe(true)
    expect(hasKey(`${PREFIX}.hero.subheading`)).toBe(true)
    expect(hasKey(`${PREFIX}.hero.body`)).toBe(true)
    for (let i = 0; i < HERO_HIGHLIGHT_COUNT; i++) {
      expect(hasKey(`${PREFIX}.hero.highlight.${i}`)).toBe(true)
    }
  })

  it('exposes the trust band, how-it-works, and audience copy', () => {
    expect(hasKey(`${PREFIX}.trust.label`)).toBe(true)
    expect(hasKey(`${PREFIX}.how.heading`)).toBe(true)
    for (let i = 0; i < HOW_STEP_COUNT; i++) {
      expect(hasKey(`${PREFIX}.how.step.${i}.title`)).toBe(true)
      expect(hasKey(`${PREFIX}.how.step.${i}.body`)).toBe(true)
    }
    expect(hasKey(`${PREFIX}.audience.heading`)).toBe(true)
    for (let i = 0; i < AUDIENCE_ITEM_COUNT; i++) {
      expect(hasKey(`${PREFIX}.audience.item.${i}`)).toBe(true)
    }
  })

  it('exposes the program details rows', () => {
    expect(hasKey(`${PREFIX}.details.heading`)).toBe(true)
    expect(hasKey(`${PREFIX}.details.headerLabel`)).toBe(true)
    expect(hasKey(`${PREFIX}.details.headerValue`)).toBe(true)
    for (let i = 0; i < DETAILS_ROW_COUNT; i++) {
      expect(hasKey(`${PREFIX}.details.row.${i}.label`)).toBe(true)
      expect(hasKey(`${PREFIX}.details.row.${i}.value`)).toBe(true)
    }
  })

  it('matches every brand-asset tile to a translation key', () => {
    expect(hasKey(`${PREFIX}.assets.heading`)).toBe(true)
    expect(hasKey(`${PREFIX}.assets.subheading`)).toBe(true)
    expect(hasKey(`${PREFIX}.assets.downloadLabel`)).toBe(true)
    expect(hasKey(`${PREFIX}.assets.comingSoonLabel`)).toBe(true)
    for (const asset of brandAssets) {
      expect(hasKey(asset.titleKey)).toBe(true)
    }
  })

  it('exposes every 1-indexed faq.<n>.q/a pair from 1 to AFFILIATE_FAQ_COUNT (FAQSection contract)', () => {
    expect(AFFILIATE_FAQ_PREFIX).toBe(`${PREFIX}.faq`)
    expect(hasKey(AFFILIATE_FAQ_HEADING_KEY)).toBe(true)
    for (let n = 1; n <= AFFILIATE_FAQ_COUNT; n++) {
      expect(hasKey(`${AFFILIATE_FAQ_PREFIX}.${n}.q`)).toBe(true)
      expect(hasKey(`${AFFILIATE_FAQ_PREFIX}.${n}.a`)).toBe(true)
    }
  })

  it('keeps AFFILIATE_FAQ_COUNT in sync with the actual faq.<n>.q keys in translations', () => {
    const faqQuestionKeyPattern = new RegExp(
      `^${AFFILIATE_FAQ_PREFIX}\\.(\\d+)\\.q$`
    )
    const indices = translationKeys
      .map((k) => k.match(faqQuestionKeyPattern)?.[1])
      .filter((m): m is string => m !== undefined)
      .map((s) => parseInt(s, 10))
      .sort((a, b) => a - b)
    expect(indices).toEqual(
      Array.from({ length: AFFILIATE_FAQ_COUNT }, (_, i) => i + 1)
    )
  })

  it('exposes the footer cta copy', () => {
    expect(hasKey(`${PREFIX}.footerCta.heading`)).toBe(true)
    expect(hasKey(`${PREFIX}.footerCta.termsLink`)).toBe(true)
  })

  it('returns non-empty english copy for every affiliate-landing key', () => {
    for (const key of affiliateKeys()) {
      expect(t(key as never, 'en').trim().length).toBeGreaterThan(0)
    }
  })

  it('does not leak internal-only keys (drafts, todos, open questions)', () => {
    const leaks = affiliateKeys().filter((k) =>
      INTERNAL_KEY_PATTERNS.some((re) => re.test(k))
    )
    expect(leaks).toEqual([])
  })
})
