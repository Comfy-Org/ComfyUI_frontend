import { describe, expect, it } from 'vitest'

import type { TranslationPipelineConfig } from './config'
import { partitionLocale } from './locale-retention'
import type { LocaleObject } from './locale-tree'
import {
  collectLeaves,
  collectPendingLeaves,
  diffLocaleSources,
  pathKey,
  rebuildLocale,
  serializeLocale
} from './locale-tree'

const preserve: TranslationPipelineConfig['existingCopy'] = {
  kind: 'preserve',
  excludedKeyPrefixes: []
}

function simulateGeneration({
  previousEnglish,
  english,
  existing,
  excludedPaths = [],
  policy = preserve
}: {
  previousEnglish: LocaleObject
  english: LocaleObject
  existing: LocaleObject
  excludedPaths?: string[][]
  policy?: TranslationPipelineConfig['existingCopy']
}): LocaleObject {
  const changes = diffLocaleSources(previousEnglish, english)
  const invalidated = new Set(
    [...changes.added, ...changes.modified].map(pathKey)
  )
  const { retained, omitted } = partitionLocale({
    sourceLeaves: collectLeaves(english),
    previousEnglish,
    existing,
    modifiedKeys: new Set(changes.modified.map(pathKey)),
    policy,
    excludedKeys: new Set(excludedPaths.map(pathKey))
  })
  const regenerated = collectPendingLeaves(english, existing, invalidated)
    .filter(({ path }) => !retained.has(pathKey(path)))
    .filter(({ path }) => !omitted.has(pathKey(path)))
  return rebuildLocale(
    english,
    existing,
    invalidated,
    new Map([
      ...retained,
      ...regenerated.map(
        ({ path, value }) => [pathKey(path), `MT(${value})`] as const
      )
    ]),
    omitted
  )
}

describe('locale retention', () => {
  it.for<
    Parameters<typeof simulateGeneration>[0] & {
      label: string
      expected: LocaleObject
    }
  >([
    {
      label: 'unchanged copy is retained',
      previousEnglish: { title: 'Hello' },
      english: { title: 'Hello' },
      existing: { title: 'こんにちは' },
      expected: { title: 'こんにちは' }
    },
    {
      label: 'intentional empty translation is retained',
      previousEnglish: { title: 'Hello' },
      english: { title: 'Hello' },
      existing: { title: '' },
      expected: { title: '' }
    },
    {
      label: 'nonempty locale fragment for empty English is retained',
      previousEnglish: { suffix: '' },
      english: { suffix: '' },
      existing: { suffix: 'さん' },
      expected: { suffix: 'さん' }
    },
    {
      label: 'added English key keeps a translation that already exists',
      previousEnglish: {},
      english: { title: 'Hello' },
      existing: { title: 'こんにちは' },
      expected: { title: 'こんにちは' }
    },
    {
      label: 'unchanged locale under changed English is regenerated',
      previousEnglish: { title: 'Old' },
      english: { title: 'New' },
      existing: { title: '古い' },
      expected: { title: 'MT(New)' }
    },
    {
      label: 'locale edited alongside English is regenerated',
      previousEnglish: { title: 'Old' },
      english: { title: 'New' },
      existing: { title: '新しい' },
      expected: { title: 'MT(New)' }
    }
  ])('$label', ({ expected, ...input }) => {
    expect(simulateGeneration(input)).toEqual(expected)
  })

  it('regenerates changed English copy when policy is regenerate', () => {
    expect(
      simulateGeneration({
        previousEnglish: { title: 'Old', kept: 'Kept' },
        english: { title: 'New', kept: 'Kept' },
        existing: { title: '人が直した', kept: '保持' },
        policy: { kind: 'regenerate' }
      })
    ).toEqual({ kept: '保持', title: 'MT(New)' })
  })

  describe('excluded copy', () => {
    const excludedPaths = [['tos', 'body']]
    const changedEnglish = {
      previousEnglish: { tos: { body: 'Old terms' } },
      english: { tos: { body: 'New terms' } },
      excludedPaths
    }

    it.for<{ label: string; existing: LocaleObject }>([
      { label: 'missing', existing: {} },
      { label: 'English duplicate', existing: { tos: { body: 'New terms' } } },
      {
        label: 'previous English duplicate',
        existing: { tos: { body: 'Old terms' } }
      }
    ])('omits $label copy for runtime fallback', ({ existing }) => {
      expect(simulateGeneration({ ...changedEnglish, existing })).toEqual({})
    })

    it.for<{ label: string; existing: LocaleObject }>([
      { label: 'a translation', existing: { tos: { body: '旧規約' } } },
      {
        label: 'an intentional empty translation',
        existing: { tos: { body: '' } }
      }
    ])('keeps $label after English changes', ({ existing }) => {
      expect(simulateGeneration({ ...changedEnglish, existing })).toEqual(
        existing
      )
    })

    it('prunes the translation when its English source is deleted', () => {
      expect(
        simulateGeneration({
          ...changedEnglish,
          english: {},
          existing: { tos: { body: '旧規約' } }
        })
      ).toEqual({})
    })
  })

  it('rebuilds in sorted key order, keeping empty source objects and dropping emptied ones', () => {
    const output = rebuildLocale(
      { b: 'B', a: { z: 'Z', y: 'Y' }, empty: {}, tos: { body: 'Terms' } },
      { b: 'ビー', a: { y: 'ワイ', z: 'ゼット' } },
      new Set(),
      new Map(),
      new Set([pathKey(['tos', 'body'])])
    )

    expect(serializeLocale(output)).toBe(
      '{\n  "a": {\n    "y": "ワイ",\n    "z": "ゼット"\n  },\n  "b": "ビー",\n  "empty": {}\n}\n'
    )
  })
})
