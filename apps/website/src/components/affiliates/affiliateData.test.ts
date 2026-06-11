import { describe, expect, it } from 'vitest'

import { externalLinks, getRoutes } from '../../config/routes'
import { hasKey, t } from '../../i18n/translations'
import {
  AFFILIATE_FAQ_COUNT,
  AFFILIATE_FAQ_HEADING_KEY,
  AFFILIATE_FAQ_PREFIX
} from './affiliateFaqs'
import { brandAssets } from './brandAssets'
import { programDetailRows } from './programDetails'

// ---------------------------------------------------------------------------
// brandAssets.ts
// ---------------------------------------------------------------------------

describe('brandAssets data integrity', () => {
  it('exports a non-empty array', () => {
    expect(Array.isArray(brandAssets)).toBe(true)
    expect(brandAssets.length).toBeGreaterThan(0)
  })

  it('has exactly 8 brand assets', () => {
    expect(brandAssets).toHaveLength(8)
  })

  it('every asset has a non-empty id', () => {
    for (const asset of brandAssets) {
      expect(asset.id.trim().length, `asset id is empty`).toBeGreaterThan(0)
    }
  })

  it('every asset id is unique', () => {
    const ids = brandAssets.map((a) => a.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('every asset id uses kebab-case only (no spaces or uppercase letters)', () => {
    const kebabCase = /^[a-z0-9]+(-[a-z0-9]+)*$/
    for (const asset of brandAssets) {
      expect(
        kebabCase.test(asset.id),
        `asset id "${asset.id}" is not kebab-case`
      ).toBe(true)
    }
  })

  it('every asset download path is a non-empty string beginning with "/"', () => {
    for (const asset of brandAssets) {
      expect(
        asset.download.length,
        `download path for "${asset.id}" is empty`
      ).toBeGreaterThan(0)
      expect(
        asset.download.startsWith('/'),
        `download path for "${asset.id}" does not start with "/"`
      ).toBe(true)
    }
  })

  it('every asset preview path is a non-empty string beginning with "/"', () => {
    for (const asset of brandAssets) {
      expect(
        asset.preview.length,
        `preview path for "${asset.id}" is empty`
      ).toBeGreaterThan(0)
      expect(
        asset.preview.startsWith('/'),
        `preview path for "${asset.id}" does not start with "/"`
      ).toBe(true)
    }
  })

  it('every asset download path has a recognisable file extension', () => {
    const knownExtensions = /\.(svg|png|jpg|jpeg|webp|gif|zip)$/i
    for (const asset of brandAssets) {
      expect(
        knownExtensions.test(asset.download),
        `download path "${asset.download}" has no recognised extension`
      ).toBe(true)
    }
  })

  it('every asset titleKey is a valid translation key with non-empty English copy', () => {
    for (const asset of brandAssets) {
      expect(
        hasKey(asset.titleKey),
        `titleKey "${asset.titleKey}" not found in translations`
      ).toBe(true)
      expect(
        t(asset.titleKey, 'en').trim().length,
        `titleKey "${asset.titleKey}" has empty English copy`
      ).toBeGreaterThan(0)
    }
  })

  it('every asset titleKey starts with "affiliate-landing.assets.tile."', () => {
    const TILE_PREFIX = 'affiliate-landing.assets.tile.'
    for (const asset of brandAssets) {
      expect(
        asset.titleKey.startsWith(TILE_PREFIX),
        `titleKey "${asset.titleKey}" does not start with "${TILE_PREFIX}"`
      ).toBe(true)
    }
  })

  it('the comfy-amplified-logo.png asset was removed (renamed to svg variants)', () => {
    // Regression guard: the PR deleted comfy-amplified-logo.png and the old PNG
    // download path should no longer appear in brandAssets.
    const hasPngAmplifiedLogo = brandAssets.some(
      (a) => a.download.endsWith('comfy-amplified-logo.png')
    )
    expect(hasPngAmplifiedLogo).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// programDetails.ts
// ---------------------------------------------------------------------------

describe('programDetailRows data integrity', () => {
  it('exports a non-empty array', () => {
    expect(Array.isArray(programDetailRows)).toBe(true)
    expect(programDetailRows.length).toBeGreaterThan(0)
  })

  it('has exactly 6 program detail rows', () => {
    expect(programDetailRows).toHaveLength(6)
  })

  it('all labelKeys are unique', () => {
    const labelKeys = programDetailRows.map((r) => r.labelKey)
    const unique = new Set(labelKeys)
    expect(unique.size).toBe(labelKeys.length)
  })

  it('all valueKeys are unique', () => {
    const valueKeys = programDetailRows.map((r) => r.valueKey)
    const unique = new Set(valueKeys)
    expect(unique.size).toBe(valueKeys.length)
  })

  it('no row shares a labelKey with its valueKey', () => {
    for (const row of programDetailRows) {
      expect(row.labelKey).not.toBe(row.valueKey)
    }
  })

  it('all labelKeys are valid translation keys with non-empty English copy', () => {
    for (const row of programDetailRows) {
      expect(
        hasKey(row.labelKey),
        `labelKey "${row.labelKey}" not found in translations`
      ).toBe(true)
      expect(
        t(row.labelKey, 'en').trim().length,
        `labelKey "${row.labelKey}" has empty English copy`
      ).toBeGreaterThan(0)
    }
  })

  it('all valueKeys are valid translation keys with non-empty English copy', () => {
    for (const row of programDetailRows) {
      expect(
        hasKey(row.valueKey),
        `valueKey "${row.valueKey}" not found in translations`
      ).toBe(true)
      expect(
        t(row.valueKey, 'en').trim().length,
        `valueKey "${row.valueKey}" has empty English copy`
      ).toBeGreaterThan(0)
    }
  })

  it('all labelKeys follow the "affiliate-landing.details.row.<n>.label" pattern', () => {
    const pattern = /^affiliate-landing\.details\.row\.\d+\.label$/
    for (const row of programDetailRows) {
      expect(
        pattern.test(row.labelKey),
        `labelKey "${row.labelKey}" does not match expected pattern`
      ).toBe(true)
    }
  })

  it('all valueKeys follow the "affiliate-landing.details.row.<n>.value" pattern', () => {
    const pattern = /^affiliate-landing\.details\.row\.\d+\.value$/
    for (const row of programDetailRows) {
      expect(
        pattern.test(row.valueKey),
        `valueKey "${row.valueKey}" does not match expected pattern`
      ).toBe(true)
    }
  })

  it('row indices are zero-based and contiguous', () => {
    const indexRegex = /\.row\.(\d+)\.label$/
    const indices = programDetailRows
      .map((r) => r.labelKey.match(indexRegex)?.[1])
      .filter((m): m is string => m !== undefined)
      .map((s) => parseInt(s, 10))
    expect(indices).toEqual(
      Array.from({ length: programDetailRows.length }, (_, i) => i)
    )
  })
})

// ---------------------------------------------------------------------------
// affiliateFaqs.ts — constant values and types
// ---------------------------------------------------------------------------

describe('affiliateFaqs constants', () => {
  it('AFFILIATE_FAQ_PREFIX is exactly "affiliate-landing.faq"', () => {
    expect(AFFILIATE_FAQ_PREFIX).toBe('affiliate-landing.faq')
  })

  it('AFFILIATE_FAQ_HEADING_KEY is exactly "affiliate-landing.faq.heading"', () => {
    expect(AFFILIATE_FAQ_HEADING_KEY).toBe('affiliate-landing.faq.heading')
  })

  it('AFFILIATE_FAQ_HEADING_KEY starts with AFFILIATE_FAQ_PREFIX', () => {
    expect(AFFILIATE_FAQ_HEADING_KEY.startsWith(AFFILIATE_FAQ_PREFIX)).toBe(
      true
    )
  })

  it('AFFILIATE_FAQ_COUNT is a positive integer', () => {
    expect(Number.isInteger(AFFILIATE_FAQ_COUNT)).toBe(true)
    expect(AFFILIATE_FAQ_COUNT).toBeGreaterThan(0)
  })

  it('AFFILIATE_FAQ_COUNT is 8 (regression guard against accidental changes)', () => {
    expect(AFFILIATE_FAQ_COUNT).toBe(8)
  })

  it('AFFILIATE_FAQ_HEADING_KEY resolves to a non-empty English string', () => {
    expect(hasKey(AFFILIATE_FAQ_HEADING_KEY)).toBe(true)
    expect(t(AFFILIATE_FAQ_HEADING_KEY, 'en').trim().length).toBeGreaterThan(0)
  })

  it('there are no FAQ keys beyond AFFILIATE_FAQ_COUNT', () => {
    const beyondCount = hasKey(
      `${AFFILIATE_FAQ_PREFIX}.${AFFILIATE_FAQ_COUNT + 1}.q` as never
    )
    expect(beyondCount).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// FooterCtaSection.vue config dependencies
// ---------------------------------------------------------------------------

describe('FooterCtaSection config dependencies', () => {
  it('externalLinks.affiliateApplicationForm is the canonical Google Form URL', () => {
    expect(externalLinks.affiliateApplicationForm).toBe(
      'https://forms.gle/RS8L2ttcuGap4Q1v6'
    )
  })

  it('externalLinks.affiliateApplicationForm is a well-formed https URL', () => {
    expect(() => new URL(externalLinks.affiliateApplicationForm)).not.toThrow()
    expect(
      new URL(externalLinks.affiliateApplicationForm).protocol
    ).toBe('https:')
  })

  it('affiliateTerms route is "/affiliates/terms" for English locale', () => {
    expect(getRoutes('en').affiliateTerms).toBe('/affiliates/terms')
  })

  it('affiliateTerms route is locale-invariant (same for zh-CN)', () => {
    // Guards against re-introducing /zh-CN/affiliates/terms, which would
    // bypass the legal review that applies only to the English copy.
    expect(getRoutes('zh-CN').affiliateTerms).toBe('/affiliates/terms')
  })

  it('affiliates base route uses the expected path', () => {
    expect(getRoutes('en').affiliates).toBe('/affiliates')
  })

  it('footer CTA copy keys are present in translations', () => {
    expect(hasKey('affiliate-landing.footerCta.heading')).toBe(true)
    expect(hasKey('affiliate-landing.footerCta.termsLink')).toBe(true)
    expect(hasKey('affiliate-landing.cta.apply')).toBe(true)
    expect(hasKey('affiliate-landing.cta.applyAriaLabel')).toBe(true)
  })

  it('footer CTA copy keys return non-empty English strings', () => {
    const keys = [
      'affiliate-landing.footerCta.heading',
      'affiliate-landing.footerCta.termsLink',
      'affiliate-landing.cta.apply',
      'affiliate-landing.cta.applyAriaLabel'
    ] as const
    for (const key of keys) {
      expect(t(key, 'en').trim().length, `key "${key}" is empty`).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// AudienceSection.vue — translation key contract
// ---------------------------------------------------------------------------

describe('AudienceSection translation keys', () => {
  const AUDIENCE_ITEM_COUNT = 5
  const AUDIENCE_PREFIX = 'affiliate-landing.audience'

  it('audience heading key exists and is non-empty', () => {
    expect(hasKey(`${AUDIENCE_PREFIX}.heading`)).toBe(true)
    expect(t(`${AUDIENCE_PREFIX}.heading` as never, 'en').trim().length).toBeGreaterThan(0)
  })

  it(`provides exactly ${AUDIENCE_ITEM_COUNT} audience item keys (item.0 through item.4)`, () => {
    for (let i = 0; i < AUDIENCE_ITEM_COUNT; i++) {
      expect(
        hasKey(`${AUDIENCE_PREFIX}.item.${i}`),
        `missing key: ${AUDIENCE_PREFIX}.item.${i}`
      ).toBe(true)
    }
  })

  it('does not have an audience item beyond index 4 (prevents silent skipping)', () => {
    expect(hasKey(`${AUDIENCE_PREFIX}.item.${AUDIENCE_ITEM_COUNT}` as never)).toBe(false)
  })

  it('all audience item keys return non-empty English text', () => {
    for (let i = 0; i < AUDIENCE_ITEM_COUNT; i++) {
      const key = `${AUDIENCE_PREFIX}.item.${i}` as never
      expect(
        t(key, 'en').trim().length,
        `audience item ${i} has empty English copy`
      ).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// BrandAssetsSection.vue — section-level translation key contract
// ---------------------------------------------------------------------------

describe('BrandAssetsSection translation keys', () => {
  const ASSETS_PREFIX = 'affiliate-landing.assets'

  it('heading, subheading, and downloadLabel keys all exist', () => {
    expect(hasKey(`${ASSETS_PREFIX}.heading`)).toBe(true)
    expect(hasKey(`${ASSETS_PREFIX}.subheading`)).toBe(true)
    expect(hasKey(`${ASSETS_PREFIX}.downloadLabel`)).toBe(true)
  })

  it('all section-level keys return non-empty English copy', () => {
    const keys = [
      `${ASSETS_PREFIX}.heading`,
      `${ASSETS_PREFIX}.subheading`,
      `${ASSETS_PREFIX}.downloadLabel`
    ] as const
    for (const key of keys) {
      expect(t(key as never, 'en').trim().length, `key "${key}" is empty`).toBeGreaterThan(0)
    }
  })

  it('every asset titleKey starts under the tile namespace', () => {
    const tilePrefix = `${ASSETS_PREFIX}.tile.`
    for (const asset of brandAssets) {
      expect(
        asset.titleKey.startsWith(tilePrefix),
        `titleKey "${asset.titleKey}" doesn't start with "${tilePrefix}"`
      ).toBe(true)
    }
    // Guard: the BrandAssetsSection renders one card per entry in brandAssets
    expect(brandAssets.length).toBe(8)
  })
})
