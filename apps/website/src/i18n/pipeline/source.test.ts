import { describe, expect, it } from 'vitest'

import {
  approvedLayer,
  buildEnglishSource,
  buildManifest,
  pendingSource,
  translatableEntries,
  hashValue,
  pruneOrphanKeys,
  pruneStaleKeys,
  staleKeys
} from './source'
import type { SourceEntry } from './types'

const entries: SourceEntry[] = [
  {
    key: 'hero.title',
    english: 'Build anything',
    approved: { 'zh-CN': '构建一切' }
  },
  {
    key: 'hero.brand',
    // A value a person approved that is deliberately identical to English.
    approved: { 'zh-CN': 'ComfyUI' },
    english: 'ComfyUI'
  },
  { key: 'hero.new', english: 'Brand new', approved: {} }
]

describe('hashValue', () => {
  it('is stable for the same value and changes with it', () => {
    expect(hashValue('a')).toBe(hashValue('a'))
    expect(hashValue('a')).not.toBe(hashValue('b'))
    expect(hashValue('a')).toHaveLength(12)
  })
})

describe('buildEnglishSource', () => {
  it('is the English content-of-record, keyed by translation key', () => {
    expect(buildEnglishSource(entries)).toEqual({
      'hero.title': 'Build anything',
      'hero.brand': 'ComfyUI',
      'hero.new': 'Brand new'
    })
  })

  /**
   * `translations.ts` blanks one half of a word-order fragment pair per language
   * (see the adapter's test). There is nothing to translate in an empty string,
   * and handing one to the model invites it to invent something, so these keys
   * never enter the translatable source.
   */
  it('omits keys with nothing to translate', () => {
    const withBlank: SourceEntry[] = [
      ...entries,
      { key: 'hero.fragment', english: '', approved: {} },
      { key: 'hero.spaces', english: '   ', approved: {} }
    ]
    const source = buildEnglishSource(withBlank)
    expect(source).not.toHaveProperty('hero.fragment')
    expect(source).not.toHaveProperty('hero.spaces')
    expect(Object.keys(source)).toHaveLength(3)
  })
})

describe('buildManifest', () => {
  it('records the hash of each English string', () => {
    const manifest = buildManifest(entries)
    expect(manifest['hero.title']).toBe(hashValue('Build anything'))
    expect(Object.keys(manifest)).toHaveLength(3)
  })
})

describe('approvedLayer', () => {
  /**
   * The one place marketing must NOT copy the hub. `buildHumanSeed` there treats a
   * translation equal to its English as untranslated and hands it back to the
   * model. Marketing has approved values that are legitimately identical to
   * English (ComfyUI, MiniMax, version numbers), and re-translating them would
   * overwrite human work, which is the thing this pipeline promises never to do.
   */
  it('counts a value identical to English as approved, not as missing', () => {
    expect(approvedLayer(entries, 'zh-CN')).toEqual({
      'hero.title': '构建一切',
      'hero.brand': 'ComfyUI'
    })
  })

  it('omits keys the locale has no approved value for', () => {
    expect(approvedLayer(entries, 'ja')).toEqual({})
  })
})

describe('translatableEntries', () => {
  /**
   * Contracts are never machine-translated. An AI-written Terms of Service or
   * MSA is a liability rather than a feature, and these pages are already served
   * English-only or noindexed, so excluding them changes nothing a reader sees.
   * Chinese is unaffected either way: it is already human-translated.
   */
  it.for([
    'tos.heading',
    'enterprise-msa.section.one',
    'privacy.intro',
    'desktop_privacy.intro',
    'affiliate-terms.clause',
    'minimaxLicense.terms'
  ])('excludes legal copy: %s', (key) => {
    const kept = translatableEntries([{ key, english: 'x', approved: {} }])
    expect(kept).toEqual([])
  })

  /**
   * The exclusion matches whole key segments. `enterprise` is the marketing
   * page and must survive; only `enterprise-msa` is the contract. A substring
   * match would silently drop 71 keys of ordinary marketing copy.
   */
  it('keeps marketing copy whose prefix merely starts the same way', () => {
    const kept = translatableEntries([
      { key: 'enterprise.hero.title', english: 'x', approved: {} },
      { key: 'privacyBanner.accept', english: 'x', approved: {} }
    ])
    expect(kept.map((entry) => entry.key)).toEqual([
      'enterprise.hero.title',
      'privacyBanner.accept'
    ])
  })

  /**
   * Pages that are structured but deliberately not sent to the model: a one-off
   * launch page, and a page whose own description calls it temporary. Extracting
   * their copy makes them locale-generic like every other page; translating them
   * would spend money and reviewer time on copy nobody asked to see in another
   * language.
   */
  it.for([
    'pixal3dTrellis2.meta.title',
    'platform.serverlessAnimation.meta.description'
  ])('excludes a page opted out of translation: %s', (key) => {
    const kept = translatableEntries([{ key, english: 'x', approved: {} }])
    expect(kept).toEqual([])
  })

  it('opts out only the named page, not the section around it', () => {
    // `platform` carries the marketing section's keys and must survive; only
    // `platform.serverlessAnimation` opted out. Matching on a raw prefix rather
    // than on segment boundaries would also swallow a sibling whose name merely
    // starts the same way.
    const kept = translatableEntries([
      { key: 'platform.hero.title', english: 'x', approved: {} },
      { key: 'platform.serverlessAnimationStudy.x', english: 'x', approved: {} }
    ])
    expect(kept.map((entry) => entry.key)).toEqual([
      'platform.hero.title',
      'platform.serverlessAnimationStudy.x'
    ])
  })
})

describe('pendingSource', () => {
  /**
   * What the model is actually asked to translate for one locale: the English
   * content-of-record minus everything already answered. "AI fills only what is
   * absent" is the rule, and this is where it is enforced.
   *
   * Approved values are excluded, so the model is never asked to produce a
   * string that could not be displayed anyway (approved always wins at resolve
   * time). That also keeps the reviewer's budget off strings nobody will see.
   */
  it('asks for only what the locale is missing', () => {
    expect(pendingSource(entries, 'zh-CN', {})).toEqual({
      // hero.title and hero.brand are approved, so only the new key is pending.
      'hero.new': 'Brand new'
    })
  })

  it('asks for everything when the locale has nothing', () => {
    expect(pendingSource(entries, 'ja', {})).toEqual({
      'hero.title': 'Build anything',
      'hero.brand': 'ComfyUI',
      'hero.new': 'Brand new'
    })
  })

  it('does not re-request a key the model already translated', () => {
    expect(
      pendingSource(entries, 'ja', { 'hero.title': '何でも作れる' })
    ).toEqual({
      'hero.brand': 'ComfyUI',
      'hero.new': 'Brand new'
    })
  })

  it('never asks for a key with nothing to translate', () => {
    const withBlank: SourceEntry[] = [
      { key: 'frag', english: '', approved: {} }
    ]
    expect(pendingSource(withBlank, 'ja', {})).toEqual({})
  })
})

describe('staleKeys', () => {
  it('names only the keys whose English changed since the last run', () => {
    const prev = { a: hashValue('one'), b: hashValue('two') }
    const next = { a: hashValue('one'), b: hashValue('CHANGED') }
    expect(staleKeys(prev, next)).toEqual(['b'])
  })

  it('does not call a brand-new key stale', () => {
    // A new key has no prior hash, so there is no machine translation to drop.
    // Calling it stale would be harmless but misleading; lobe translates it fresh.
    const prev = { a: hashValue('one') }
    const next = { a: hashValue('one'), b: hashValue('new') }
    expect(staleKeys(prev, next)).toEqual([])
  })
})

describe('pruneStaleKeys', () => {
  it('drops only the changed keys from the machine layer', () => {
    const machine = { a: 'ア', b: 'イ', c: 'ウ' }
    expect(pruneStaleKeys(machine, ['b'])).toEqual({ a: 'ア', c: 'ウ' })
  })
})

describe('pruneOrphanKeys', () => {
  /**
   * Runs every build, independent of staleness. Without it a deleted key's
   * machine translation lingers with no English source; if the same key is later
   * re-added with different English, it has no prior hash so it is not "stale",
   * while lobe sees an already-translated key and skips it. The page would then
   * serve an obsolete translation for new English.
   */
  it('drops machine entries whose English key no longer exists', () => {
    const machine = { a: 'ア', gone: 'ゴ' }
    expect(pruneOrphanKeys(machine, new Set(['a']))).toEqual({ a: 'ア' })
  })
})
