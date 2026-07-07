import { describe, it, expect } from 'vitest'
import type { TemplateRef } from './agentCore'
import {
  coerceWidgetValue,
  mutationLanded,
  enforceSnapshotCap,
  removeSnapshotById,
  isMutationLive,
  normalizeTemplateText,
  matchTemplate
} from './agentCore'

const ctx = { widgetName: 'w', nodeId: 7 }

describe('coerceWidgetValue', () => {
  describe('number widget', () => {
    it('passes a number through unchanged', () => {
      expect(coerceWidgetValue(0, 42, undefined, ctx)).toBe(42)
    })
    it('parses a numeric string', () => {
      expect(coerceWidgetValue(0, '  12.5 ', undefined, ctx)).toBe(12.5)
    })
    it('rejects a non-numeric string with a descriptive error', () => {
      expect(() => coerceWidgetValue(0, 'abc', undefined, ctx)).toThrow(
        'Widget "w" on node 7 expects a number; got "abc"'
      )
    })
    it('rejects NaN / non-finite inputs rather than storing them', () => {
      expect(() => coerceWidgetValue(0, 'NaN', undefined, ctx)).toThrow(
        /expects a number/
      )
      expect(() => coerceWidgetValue(0, Infinity, undefined, ctx)).toThrow(
        /expects a number/
      )
    })
    it('rejects an empty or whitespace-only string rather than storing 0', () => {
      expect(() => coerceWidgetValue(0, '', undefined, ctx)).toThrow(
        /expects a number/
      )
      expect(() => coerceWidgetValue(0, '   ', undefined, ctx)).toThrow(
        /expects a number/
      )
    })
    it('clamps to min and max (and returns the clamped value)', () => {
      expect(coerceWidgetValue(5, 100, { min: 0, max: 50 }, ctx)).toBe(50)
      expect(coerceWidgetValue(5, -3, { min: 0, max: 50 }, ctx)).toBe(0)
      expect(coerceWidgetValue(5, 25, { min: 0, max: 50 }, ctx)).toBe(25)
    })
  })

  describe('string widget', () => {
    it('passes a string through unchanged', () => {
      expect(coerceWidgetValue('hi', 'there', undefined, ctx)).toBe('there')
    })
    it('stringifies a non-string value', () => {
      expect(coerceWidgetValue('hi', 99, undefined, ctx)).toBe('99')
      expect(coerceWidgetValue('hi', true, undefined, ctx)).toBe('true')
    })
  })

  describe('boolean widget', () => {
    it('passes a boolean through unchanged', () => {
      expect(coerceWidgetValue(false, true, undefined, ctx)).toBe(true)
    })
    it.for([
      ['true', true],
      ['TRUE', true],
      ['1', true],
      ['false', false],
      ['False', false],
      ['0', false]
    ] as const)('coerces %j to %j', ([input, expected]) => {
      expect(coerceWidgetValue(false, input, undefined, ctx)).toBe(expected)
    })
    it('coerces the number 1/0 via String()', () => {
      expect(coerceWidgetValue(false, 1, undefined, ctx)).toBe(true)
      expect(coerceWidgetValue(false, 0, undefined, ctx)).toBe(false)
    })
    it('rejects an unparseable boolean', () => {
      expect(() => coerceWidgetValue(false, 'maybe', undefined, ctx)).toThrow(
        'Widget "w" on node 7 expects a boolean; got "maybe"'
      )
    })
  })

  describe('combo / options validation', () => {
    it('accepts a value present in options.values', () => {
      expect(
        coerceWidgetValue('a', 'b', { values: ['a', 'b', 'c'] }, ctx)
      ).toBe('b')
    })
    it('rejects a value not in options.values', () => {
      expect(() =>
        coerceWidgetValue('a', 'z', { values: ['a', 'b'] }, ctx)
      ).toThrow('Widget "w" only accepts: a, b')
    })
    it('enforces values BEFORE clamping (out-of-list number throws, not clamped)', () => {
      expect(() =>
        coerceWidgetValue(1, 99, { values: [1, 2, 3], min: 0, max: 3 }, ctx)
      ).toThrow(/only accepts/)
    })
  })

  it('leaves an unknown prev type as the raw value (still options-validated)', () => {
    // prev null → no type coercion branch; value passes through
    expect(coerceWidgetValue(null, { a: 1 }, undefined, ctx)).toEqual({ a: 1 })
  })
})

describe('mutationLanded', () => {
  it('treats a non-object result as landed (conservative — keep the undo)', () => {
    expect(mutationLanded('addNode', null)).toBe(true)
    expect(mutationLanded('addNode', undefined)).toBe(true)
    expect(mutationLanded('addNode', 'ok')).toBe(true)
  })
  it('addNode: landed only when `added` is truthy', () => {
    expect(mutationLanded('addNode', { added: 'KSampler', id: 3 })).toBe(true)
    expect(mutationLanded('addNode', { added: '', id: 3 })).toBe(false)
  })
  it('setWidgetValue: landed when id is non-null — INCLUDING id 0', () => {
    expect(
      mutationLanded('setWidgetValue', { id: 0, widget: 'seed', value: 1 })
    ).toBe(true)
    expect(mutationLanded('setWidgetValue', { id: 5 })).toBe(true)
    expect(mutationLanded('setWidgetValue', { id: null })).toBe(false)
    expect(mutationLanded('setWidgetValue', {})).toBe(false)
  })
  it.for(['openTemplate', 'loadWorkflow', 'newWorkflow'])(
    '%s: landed only when opened is truthy',
    (tool) => {
      expect(mutationLanded(tool, { opened: 'Flux' })).toBe(true)
      expect(mutationLanded(tool, { opened: null, message: 'no match' })).toBe(
        false
      )
    }
  )
  it('applyGraphMutation: only active + landed counts; new-tab discards', () => {
    expect(
      mutationLanded('applyGraphMutation', { target: 'active', landed: true })
    ).toBe(true)
    expect(
      mutationLanded('applyGraphMutation', { target: 'active', landed: false })
    ).toBe(false)
    expect(
      mutationLanded('applyGraphMutation', { target: 'new', landed: true })
    ).toBe(false)
  })
  it('unrecognized tool defaults to landed', () => {
    expect(mutationLanded('somethingElse', { whatever: true })).toBe(true)
  })
})

describe('enforceSnapshotCap', () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i }))

  it('does nothing under or at the cap', () => {
    const s = mk(3)
    enforceSnapshotCap(s, 3)
    expect(s.map((x) => x.id)).toEqual([0, 1, 2])
  })
  it('evicts the SECOND-oldest (index 1), never the pinned index 0', () => {
    const s = mk(4)
    enforceSnapshotCap(s, 3)
    expect(s.map((x) => x.id)).toEqual([0, 2, 3])
  })
  it('keeps index 0 pinned across repeated over-cap pushes (anti-bury)', () => {
    const s = [{ id: 0 }] // origin / pre-agent state
    for (let i = 1; i <= 60; i++) {
      s.push({ id: i })
      enforceSnapshotCap(s, 50)
    }
    expect(s.length).toBe(50)
    expect(s[0].id).toBe(0) // origin always survives
    expect(s[s.length - 1].id).toBe(60) // most recent retained
  })
})

describe('removeSnapshotById', () => {
  it('returns false and mutates nothing for a null id', () => {
    const s = [{ id: 1 }, { id: 2 }]
    expect(removeSnapshotById(s, null)).toBe(false)
    expect(s).toHaveLength(2)
  })
  it('removes the matching snapshot and returns true', () => {
    const s = [{ id: 1 }, { id: 2 }, { id: 3 }]
    expect(removeSnapshotById(s, 2)).toBe(true)
    expect(s.map((x) => x.id)).toEqual([1, 3])
  })
  it('returns false for an id not present (already evicted is harmless)', () => {
    const s = [{ id: 1 }, { id: 2 }]
    expect(removeSnapshotById(s, 99)).toBe(false)
    expect(s).toHaveLength(2)
  })
})

describe('isMutationLive', () => {
  const now = 1_000_000
  const ttl = 30_000
  it('false when nothing is in flight', () => {
    expect(isMutationLive([], now, ttl)).toBe(false)
  })
  it('true when a call started within the TTL', () => {
    expect(isMutationLive([now - 1], now, ttl)).toBe(true)
  })
  it('false when every call is older than the TTL (hung, not live)', () => {
    expect(isMutationLive([now - ttl - 1, now - 100_000], now, ttl)).toBe(false)
  })
  it('treats a call exactly at the cutoff as NOT live (strict >)', () => {
    expect(isMutationLive([now - ttl], now, ttl)).toBe(false)
  })
  it('true when at least one of several is live', () => {
    expect(isMutationLive([now - ttl - 1, now - 5], now, ttl)).toBe(true)
  })
})

describe('normalizeTemplateText', () => {
  it('lowercases and flattens separators', () => {
    expect(normalizeTemplateText('Flux_Dev-Basic')).toBe('flux dev basic')
  })
  it('handles nullish input', () => {
    expect(normalizeTemplateText(undefined as unknown as string)).toBe('')
  })
})

describe('matchTemplate', () => {
  const all: TemplateRef[] = [
    { id: 'default', module: 'default', title: 'Default Starter' },
    { id: 'flux_dev', module: 'default', title: 'Flux Dev' },
    { id: 'flux_schnell', module: 'core', title: 'Flux Schnell Fast' },
    { id: 'sdxl_turbo', module: 'core', title: 'SDXL Turbo' }
  ]

  it('returns the first template for an empty query (a starter)', () => {
    expect(matchTemplate(all, undefined)).toBe(all[0])
    expect(matchTemplate(all, '')).toBe(all[0])
  })
  it('returns the first template when the query is all stop-words', () => {
    expect(matchTemplate(all, 'open the template please')).toBe(all[0])
  })
  it('picks a single clear match', () => {
    expect(matchTemplate(all, 'sdxl turbo')).toBe(all[3])
  })
  it('is case- and separator-insensitive', () => {
    expect(matchTemplate(all, 'FLUX-SCHNELL')).toBe(all[2])
  })
  it('prefers the contiguous-phrase match over scattered word hits', () => {
    // "flux schnell" appears contiguously in "Flux Schnell Fast" (+3), beating the
    // two separate word hits "flux"+"schnell" it would otherwise tie on.
    expect(matchTemplate(all, 'flux schnell')).toBe(all[2])
  })
  it('strips stop-words from the query before scoring', () => {
    expect(matchTemplate(all, 'open the flux dev workflow')).toBe(all[1])
  })
  it('returns null when nothing matches (no silent fallback)', () => {
    expect(matchTemplate(all, 'nonexistent zzz')).toBeNull()
  })
  it('returns null for an empty catalog with a real query', () => {
    expect(matchTemplate([], 'flux')).toBeNull()
  })
})
