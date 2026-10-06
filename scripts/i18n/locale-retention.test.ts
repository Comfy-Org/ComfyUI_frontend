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
  published = existing,
  excludedPaths = [],
  previousReviewNeeded = [],
  policy = preserve
}: {
  previousEnglish: LocaleObject
  english: LocaleObject
  existing: LocaleObject
  published?: LocaleObject
  excludedPaths?: string[][]
  previousReviewNeeded?: string[][]
  policy?: TranslationPipelineConfig['existingCopy']
}) {
  const changes = diffLocaleSources(previousEnglish, english)
  const invalidated = new Set(
    [...changes.added, ...changes.modified].map(pathKey)
  )
  const { retained, omitted, reviewNeeded } = partitionLocale({
    sourceLeaves: collectLeaves(english),
    previousEnglish,
    existing,
    publishedLocale: published,
    modifiedKeys: new Set(changes.modified.map(pathKey)),
    policy,
    excludedKeys: new Set(excludedPaths.map(pathKey)),
    previousReviewNeeded
  })
  const regenerated = collectPendingLeaves(english, existing, invalidated)
    .filter(({ path }) => !retained.has(pathKey(path)))
    .filter(({ path }) => !omitted.has(pathKey(path)))
  const output = rebuildLocale(
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
  return { output, reviewNeeded }
}

describe('locale retention', () => {
  it.for<
    Parameters<typeof simulateGeneration>[0] & {
      label: string
      expected: LocaleObject
      expectedReview?: string[][]
    }
  >([
    {
      label: 'unchanged copy is retained',
      previousEnglish: { title: 'Hello' },
      english: { title: 'Hello' },
      published: { title: 'こんにちは' },
      existing: { title: 'こんにちは' },
      expected: { title: 'こんにちは' }
    },
    {
      label: 'intentional empty translation is retained',
      previousEnglish: { title: 'Hello' },
      english: { title: 'Hello' },
      published: { title: '' },
      existing: { title: '' },
      expected: { title: '' }
    },
    {
      label: 'nonempty locale fragment for empty English is retained',
      previousEnglish: { suffix: '' },
      english: { suffix: '' },
      published: { suffix: 'さん' },
      existing: { suffix: 'さん' },
      expected: { suffix: 'さん' }
    },
    {
      label: 'locale edited alongside English is retained and flagged',
      previousEnglish: { title: 'Old' },
      english: { title: 'New' },
      published: { title: '古い' },
      existing: { title: '新しい' },
      expected: { title: '新しい' },
      expectedReview: [['title']]
    },
    {
      label: 'added English key keeps a translation that already exists',
      previousEnglish: {},
      english: { title: 'Hello' },
      published: {},
      existing: { title: 'こんにちは' },
      expected: { title: 'こんにちは' }
    },
    {
      label: 'unchanged locale under changed English is regenerated',
      previousEnglish: { title: 'Old' },
      english: { title: 'New' },
      published: { title: '古い' },
      existing: { title: '古い' },
      expected: { title: 'MT(New)' }
    }
  ])(
    '$label',
    ({
      previousEnglish,
      english,
      published,
      existing,
      expected,
      expectedReview = []
    }) => {
      expect(
        simulateGeneration({ previousEnglish, english, published, existing })
      ).toEqual({ output: expected, reviewNeeded: expectedReview })
    }
  )

  it('regenerates changed English copy when policy is regenerate', () => {
    expect(
      simulateGeneration({
        previousEnglish: { title: 'Old', kept: 'Kept' },
        english: { title: 'New', kept: 'Kept' },
        published: { title: '古い', kept: '保持' },
        existing: { title: '人が直した', kept: '保持' },
        policy: { kind: 'regenerate' }
      }).output
    ).toEqual({ kept: '保持', title: 'MT(New)' })
  })

  describe('excluded copy', () => {
    const excludedPaths = [['tos', 'body']]
    const translated = { tos: { body: '旧規約' } }
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
      expect(simulateGeneration({ ...changedEnglish, existing })).toEqual({
        output: {},
        reviewNeeded: []
      })
    })

    it('flags retained translation for review after English changes', () => {
      expect(
        simulateGeneration({ ...changedEnglish, existing: translated })
      ).toEqual({ output: translated, reviewNeeded: [['tos', 'body']] })
    })

    it('keeps an intentional empty translation even when previous English was empty', () => {
      expect(
        simulateGeneration({
          previousEnglish: { tos: { body: '' } },
          english: { tos: { body: 'New terms' } },
          existing: { tos: { body: '' } },
          excludedPaths
        })
      ).toEqual({
        output: { tos: { body: '' } },
        reviewNeeded: [['tos', 'body']]
      })
    })
  })

  describe('outstanding review flags', () => {
    const translated = { tos: { body: '旧規約' } }
    const flaggedPublication = {
      previousEnglish: { tos: { body: 'New terms' } },
      english: { tos: { body: 'New terms' } },
      published: translated,
      previousReviewNeeded: [['tos', 'body']]
    }

    it.for<{
      label: string
      excludedPaths: string[][]
      existing: LocaleObject
      previousReviewNeeded: string[][]
      expectedReview: string[][]
    }>([
      {
        label: 'keeps the flag on excluded copy without edits',
        excludedPaths: [['tos', 'body']],
        existing: translated,
        previousReviewNeeded: [['tos', 'body']],
        expectedReview: [['tos', 'body']]
      },
      {
        label: 'keeps the flag after the exclusion is removed',
        excludedPaths: [],
        existing: translated,
        previousReviewNeeded: [['tos', 'body']],
        expectedReview: [['tos', 'body']]
      },
      {
        label: 'clears the flag when the translation is edited',
        excludedPaths: [['tos', 'body']],
        existing: { tos: { body: '新規約' } },
        previousReviewNeeded: [['tos', 'body']],
        expectedReview: []
      },
      {
        label: 'clears the flag when the reviewNeeded entry is deleted',
        excludedPaths: [],
        existing: translated,
        previousReviewNeeded: [],
        expectedReview: []
      }
    ])(
      '$label',
      ({ excludedPaths, existing, previousReviewNeeded, expectedReview }) => {
        expect(
          simulateGeneration({
            ...flaggedPublication,
            excludedPaths,
            existing,
            previousReviewNeeded
          })
        ).toEqual({ output: existing, reviewNeeded: expectedReview })
      }
    )

    it('prunes flagged copy when its English source is deleted', () => {
      expect(
        simulateGeneration({
          ...flaggedPublication,
          english: {},
          existing: translated,
          excludedPaths: [['tos', 'body']]
        })
      ).toEqual({ output: {}, reviewNeeded: [] })
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
      serializeLocale({
        a: { y: 'ワイ', z: 'ゼット' },
        b: 'ビー',
        empty: {}
      })
    )
  })
})
