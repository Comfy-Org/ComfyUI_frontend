import { describe, expect, it } from 'vitest'

import { mergeConfiguredInputs } from '@/services/litegraphService'

const RESERVED_KEYS = ['name', 'type', 'shape', 'localized_name']

interface FakeInput {
  name: string
  type: string
  shape?: number
  localized_name?: string
  widget?: { name: string }
  boundingRect: readonly [number, number, number, number]
}

interface FakeSerializedInput {
  name: string
  type?: string
  link?: number | null
}

function fresh(overrides: Partial<FakeInput> & { name: string }): FakeInput {
  return {
    type: overrides.name.toUpperCase(),
    boundingRect: [0, 0, 0, 0],
    ...overrides
  }
}

function serialized(
  overrides: Partial<FakeSerializedInput> & { name: string }
): FakeSerializedInput {
  return { link: null, ...overrides }
}

describe('mergeConfiguredInputs', () => {
  it('inserts a fresh-only input at its fresh position, not appended at the end (subgraph promoted-widget regression)', () => {
    // Reproduces the promoted-widget subgraph scenario: the subgraph's
    // "text" input is first in the fresh definition, but the workflow was
    // saved before "text" was ever promoted, so the original serialised
    // data has no "text" entry at all.
    const freshInputs = [
      fresh({ name: 'text' }),
      fresh({ name: 'clip' }),
      fresh({ name: 'model' }),
      fresh({ name: 'positive' }),
      fresh({ name: 'negative' }),
      fresh({ name: 'latent_image' })
    ]
    const serializedInputs = [
      serialized({ name: 'clip' }),
      serialized({ name: 'model' }),
      serialized({ name: 'positive' }),
      serialized({ name: 'negative' }),
      serialized({ name: 'latent_image' })
    ]

    const merged = mergeConfiguredInputs(
      freshInputs,
      serializedInputs,
      RESERVED_KEYS
    )

    expect(merged.map((input) => input.name)).toEqual([
      'text',
      'clip',
      'model',
      'positive',
      'negative',
      'latent_image'
    ])
  })

  it('is idempotent across repeated save/reload round-trips', () => {
    // The exact failure signature from ecsBridgeHistory.spec.ts: merging
    // twice in a row (as happens across undo/redo history snapshots) must
    // not change the input order the second time.
    const freshInputs = [
      fresh({ name: 'text' }),
      fresh({ name: 'clip' }),
      fresh({ name: 'model' }),
      fresh({ name: 'positive' }),
      fresh({ name: 'negative' }),
      fresh({ name: 'latent_image' })
    ]
    const initialSerialized = [
      serialized({ name: 'clip' }),
      serialized({ name: 'model' }),
      serialized({ name: 'positive' }),
      serialized({ name: 'negative' }),
      serialized({ name: 'latent_image' })
    ]

    const firstLoad = mergeConfiguredInputs(
      freshInputs,
      initialSerialized,
      RESERVED_KEYS
    )
    const secondLoad = mergeConfiguredInputs(
      freshInputs,
      firstLoad,
      RESERVED_KEYS
    )

    expect(secondLoad.map((input) => input.name)).toEqual(
      firstLoad.map((input) => input.name)
    )
  })

  it('reorders inputs known to both to the fresh definition order (#3348)', () => {
    const freshInputs = [
      fresh({ name: 'a' }),
      fresh({ name: 'b' }),
      fresh({ name: 'c' })
    ]
    const serializedInputs = [
      serialized({ name: 'c', link: 3 }),
      serialized({ name: 'a', link: 1 }),
      serialized({ name: 'b', link: 2 })
    ]

    const merged = mergeConfiguredInputs(
      freshInputs,
      serializedInputs,
      RESERVED_KEYS
    )

    expect(merged).toEqual([
      { name: 'a', type: 'A', link: 1 },
      { name: 'b', type: 'B', link: 2 },
      { name: 'c', type: 'C', link: 3 }
    ])
  })

  it('keeps a serialised-only dynamic input at its saved position (#18388)', () => {
    const freshInputs = [fresh({ name: 'combo_option' })]
    const serializedInputs = [
      serialized({ name: 'combo_option', link: 1 }),
      serialized({ name: 'dynamic_revealed', link: 2 })
    ]

    const merged = mergeConfiguredInputs(
      freshInputs,
      serializedInputs,
      RESERVED_KEYS
    )

    expect(merged.map((input) => input.name)).toEqual([
      'combo_option',
      'dynamic_revealed'
    ])
    expect(merged[1]).toEqual(serializedInputs[1])
  })

  it('keeps every autogrow member beyond the static default, each with its own link', () => {
    const freshInputs = [fresh({ name: 'image_1' })]
    const serializedInputs = [
      serialized({ name: 'image_1', link: 1 }),
      serialized({ name: 'image_2', link: 2 }),
      serialized({ name: 'image_3', link: 3 })
    ]

    const merged = mergeConfiguredInputs(
      freshInputs,
      serializedInputs,
      RESERVED_KEYS
    )

    expect(merged.map((input) => [input.name, input.link])).toEqual([
      ['image_1', 1],
      ['image_2', 2],
      ['image_3', 3]
    ])
  })

  it('matches duplicate-named fresh inputs to distinct serialised counterparts by occurrence, not just by name', () => {
    // Two separately-promoted widgets that happen to share a source widget
    // name ("value") must not collapse into a single match: each serialised
    // occurrence must pair with its own fresh occurrence, in order, and the
    // relative order of the non-duplicate input between them must survive.
    const freshInputs = [
      fresh({ name: 'value' }),
      fresh({ name: 'other' }),
      fresh({ name: 'value' })
    ]
    const serializedInputs = [
      serialized({ name: 'value', link: 10 }),
      serialized({ name: 'other', link: 20 }),
      serialized({ name: 'value', link: 30 })
    ]

    const merged = mergeConfiguredInputs(
      freshInputs,
      serializedInputs,
      RESERVED_KEYS
    )

    expect(merged.map((input) => [input.name, input.link])).toEqual([
      ['value', 10],
      ['other', 20],
      ['value', 30]
    ])
  })

  it('does not let a duplicate fresh name corrupt the relative order of other inputs', () => {
    // Regression for the positional-cursor bug (#2d90782): a name-keyed
    // lookup that collapses duplicates to one fresh index sorts the
    // non-duplicate input into the wrong place.
    const freshInputs = [
      fresh({ name: 'value' }),
      fresh({ name: 'other' }),
      fresh({ name: 'value' })
    ]
    const serializedInputs = [
      serialized({ name: 'other', link: 20 }),
      serialized({ name: 'value', link: 10 }),
      serialized({ name: 'value', link: 30 })
    ]

    const merged = mergeConfiguredInputs(
      freshInputs,
      serializedInputs,
      RESERVED_KEYS
    )

    expect(merged.map((input) => input.name)).toEqual([
      'value',
      'other',
      'value'
    ])
  })
})
