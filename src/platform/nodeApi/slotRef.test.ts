import { describe, expect, it } from 'vitest'

import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'

import { ComfyAmbiguousSlotError } from './errors'
import { resolveSlotRef, slotIdOf } from './slotRef'

const slot = (name: string) => ({ name, type: 'IMAGE' }) as INodeInputSlot

describe('slot identity', () => {
  it('assigns a stable id per slot object', () => {
    const a = slot('image')
    expect(slotIdOf(a)).toBe(slotIdOf(a))
  })

  it('gives distinct ids to distinct slots, including same-named ones', () => {
    expect(slotIdOf(slot('image'))).not.toBe(slotIdOf(slot('image')))
  })

  it('keeps the id stable when the slot moves position', () => {
    const target = slot('mask')
    const before = [slot('image'), target]
    const id = slotIdOf(target)

    const after = [slot('latent'), slot('image'), target]
    expect(resolveSlotRef(before, id)).toBe(1)
    expect(resolveSlotRef(after, id)).toBe(2)
  })
})

describe('resolveSlotRef', () => {
  const slots = [slot('image'), slot('mask'), slot('latent')]

  describe('by id', () => {
    it('resolves an assigned id', () => {
      expect(resolveSlotRef(slots, slotIdOf(slots[1]))).toBe(1)
    })

    it('returns -1 for an id belonging to another node', () => {
      expect(resolveSlotRef(slots, slotIdOf(slot('foreign')))).toBe(-1)
    })
  })

  describe('by name', () => {
    it('resolves an exact name', () => {
      expect(resolveSlotRef(slots, 'mask')).toBe(1)
    })

    it('returns -1 for an unknown name', () => {
      expect(resolveSlotRef(slots, 'nope')).toBe(-1)
    })

    it('throws on an ambiguous name rather than guessing', () => {
      // RETURN_NAMES may legitimately repeat, e.g. ("IMAGE", "IMAGE").
      const dupes = [slot('IMAGE'), slot('IMAGE')]
      expect(() => resolveSlotRef(dupes, 'IMAGE')).toThrow(
        ComfyAmbiguousSlotError
      )
      expect(() => resolveSlotRef(dupes, 'IMAGE')).toThrow(/matches 2 slots/)
    })
  })

  describe('by explicit index', () => {
    it('resolves an in-range index', () => {
      expect(resolveSlotRef(slots, { index: 2 })).toBe(2)
    })

    it('returns -1 out of range or for a non-integer', () => {
      expect(resolveSlotRef(slots, { index: 9 })).toBe(-1)
      expect(resolveSlotRef(slots, { index: -1 })).toBe(-1)
      expect(resolveSlotRef(slots, { index: 1.5 })).toBe(-1)
      expect(resolveSlotRef(slots, null as never)).toBe(-1)
      expect(resolveSlotRef(slots, {} as never)).toBe(-1)
    })
  })

  describe('transitional integer-string rule', () => {
    it("resolves '0' positionally while names are unavailable", () => {
      expect(resolveSlotRef(slots, '0')).toBe(0)
      expect(resolveSlotRef(slots, '2')).toBe(2)
    })

    it('stops resolving positionally once names are available', () => {
      const opts = { namedSlotsAvailable: true }
      expect(resolveSlotRef(slots, '0', opts)).toBe(-1)
    })

    it('still prefers a real name over the positional fallback', () => {
      // A slot genuinely named '1' must win over index 1.
      const odd = [slot('a'), slot('b'), slot('1')]
      expect(resolveSlotRef(odd, '1')).toBe(2)
    })

    it('rejects non-canonical integer strings', () => {
      expect(resolveSlotRef(slots, '01')).toBe(-1)
      expect(resolveSlotRef(slots, '1.0')).toBe(-1)
      expect(resolveSlotRef(slots, ' 1')).toBe(-1)
      expect(resolveSlotRef(slots, '-1')).toBe(-1)
      expect(resolveSlotRef(slots, '')).toBe(-1)
    })

    it('returns -1 for an out-of-range positional string', () => {
      expect(resolveSlotRef(slots, '99')).toBe(-1)
    })
  })

  it('prefers id over name when both could match', () => {
    const first = slot('shared')
    const second = slot('shared')
    const id = slotIdOf(second)
    // Name is ambiguous, but the id is not — so this must not throw.
    expect(resolveSlotRef([first, second], id)).toBe(1)
  })

  it('handles an empty slot list', () => {
    expect(resolveSlotRef([], 'image')).toBe(-1)
    expect(resolveSlotRef([], '0')).toBe(-1)
    expect(resolveSlotRef([], { index: 0 })).toBe(-1)
  })

  it('does not treat a foreign id string as a name', () => {
    expect(resolveSlotRef(slots, 'slot:999999')).toBe(-1)
  })
})
