import { describe, expect, it } from 'vitest'

import machineJa from './content/ja.json'
import { resolveTranslation, translationKeys } from './source'
import { t } from './translations'

describe('t() fallback semantics', () => {
  it('returns Japanese copy when it exists', () => {
    expect(t('hero.title', 'ja')).toBe('ビジュアルAIを自在にコントロール')
  })

  it('falls back to English when Japanese copy is missing', () => {
    // A contract key, not an ordinary one. `tags.partnerNodes` stood here until
    // P4 machine-translated it, which is what an arbitrary "untranslated"
    // example is always going to do. `tos.*` is in NEVER_TRANSLATED_NAMESPACES,
    // so no run can ever fill it and this example cannot rot.
    expect(t('tos.effectiveDateLabel', 'ja')).toBe('Effective Date')
  })

  it('preserves intentional empty string translations', () => {
    expect(t('models.list.heroTitle.before', 'zh-CN')).toBe('')
  })
})

/**
 * The layered lookup, wired to the real machine-translation files.
 *
 * `resolveValue` is unit-tested on its own; these assert the wiring, which is
 * where the promise actually lives: the pipeline may fill Japanese, and it may
 * never overwrite approved Chinese.
 */
describe('resolveTranslation provenance', () => {
  it('reports English as the source, never as a translation', () => {
    expect(resolveTranslation('tags.partnerNodes', 'en')).toEqual({
      value: 'Partner Nodes',
      provenance: 'english'
    })
  })

  it('reports hand-written Chinese as approved', () => {
    const resolved = resolveTranslation('tags.partnerNodes', 'zh-CN')
    expect(resolved.provenance).toBe('approved')
    expect(resolved.value).toBe('合作伙伴节点')
  })

  it('reports hand-written Japanese as approved', () => {
    expect(resolveTranslation('hero.title', 'ja').provenance).toBe('approved')
  })

  /**
   * A key resolving to `english` is the signal the indexability predicate
   * consumes: a page built from those is not genuinely translated.
   *
   * Japanese was 1% translated when this was written and is now filled, so the
   * example has to be a key that stays English by construction rather than one
   * that merely happens to be missing today.
   */
  it('reports an untranslated key as English, not as a translation', () => {
    expect(resolveTranslation('tos.effectiveDateLabel', 'ja')).toEqual({
      value: 'Effective Date',
      provenance: 'english'
    })
  })

  /**
   * Asked of the shipped machine layer rather than of one named key.
   *
   * `tags.partnerNodes` stood here and would have failed for a non-defect: the
   * source build drops a key from the machine layer the moment its English
   * changes, so any copy edit broke this test until the next translation run
   * refilled it. The behaviour worth pinning is not which key is machine-filled
   * but that being in the machine layer is what `machine` means — and that a
   * key sitting there can never resolve as English.
   */
  it('reports machine-filled Japanese as machine, not as approved', () => {
    const inMachineLayer = translationKeys.filter((key) =>
      Object.hasOwn(machineJa, key)
    )
    const provenances = inMachineLayer.map(
      (key) => resolveTranslation(key, 'ja').provenance
    )

    expect(inMachineLayer.length).toBeGreaterThan(100)
    expect(
      provenances.filter((provenance) => provenance === 'english')
    ).toEqual([])
    expect(provenances).toContain('machine')
  })
})
