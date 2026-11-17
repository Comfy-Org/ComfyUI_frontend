import { describe, expect, it } from 'vitest'

import {
  REACTIONS,
  pickReaction,
  reactionDuration,
  reactionFrame
} from './companionReactions'

/** Rolls from 0 to just under 1, the range `Math.random()` gives. */
const ROLLS = [...Array.from({ length: 20 }, (_, i) => i / 20), 0.999]

function reactionNamed(id: string) {
  const found = REACTIONS.find((reaction) => reaction.id === id)
  if (!found) throw new Error(`There is no reaction called ${id}.`)
  return found
}

describe('her reactions', () => {
  it('CP-34: there is more than one, each with its own name, so that she can pick another', () => {
    expect(REACTIONS.length).toBeGreaterThan(1)
    expect(new Set(REACTIONS.map(({ id }) => id)).size).toBe(REACTIONS.length)
  })

  it.for([
    { id: 'delighted', frames: ['happy'], motion: 'hop' },
    { id: 'oh', frames: ['talk-open'], motion: 'lean' },
    { id: 'giggle', frames: ['talk-wide', 'talk-open'], motion: 'wiggle' },
    { id: 'curious', frames: ['thinking'], motion: 'tilt' }
  ])(
    'CP-33: $id uses $frames and moves with a $motion',
    ({ id, frames, motion }) => {
      const reaction = reactionNamed(id)

      expect(new Set(reaction.beats.map((beat) => beat.frame))).toEqual(
        new Set(frames)
      )
      expect(reaction.motion).toBe(motion)
    }
  )

  it.for(REACTIONS)('CP-33: $id is short, 0.6 to 1.5 seconds', (reaction) => {
    expect(reactionDuration(reaction)).toBeGreaterThanOrEqual(600)
    expect(reactionDuration(reaction)).toBeLessThanOrEqual(1500)
  })

  it.for(REACTIONS)(
    'CP-36: $id never shows an arm that points, which would say something',
    (reaction) => {
      for (const { frame } of reaction.beats)
        expect(frame).not.toMatch(/^point-/)
    }
  )
})

describe('pickReaction', () => {
  it.for(REACTIONS)(
    'CP-34: never picks $id right after $id, whatever the roll',
    ({ id }) => {
      for (const roll of ROLLS)
        expect(pickReaction({ roll, last: id }).id).not.toBe(id)
    }
  )

  it.for(REACTIONS)(
    'CP-34: after $id the rolls reach every other reaction',
    ({ id }) => {
      const picked = ROLLS.map((roll) => pickReaction({ roll, last: id }).id)
      const others = REACTIONS.map((reaction) => reaction.id).filter(
        (other) => other !== id
      )

      expect(new Set(picked)).toEqual(new Set(others))
    }
  )

  it('CP-34: with no last reaction the roll alone decides, so one roll always picks the same one', () => {
    const rollFor = (index: number) => (index + 0.5) / REACTIONS.length

    expect(
      REACTIONS.map((_, index) =>
        pickReaction({ roll: rollFor(index), last: null })
      )
    ).toEqual(REACTIONS)
    expect(pickReaction({ roll: 0.3, last: 'oh' })).toBe(
      pickReaction({ roll: 0.3, last: 'oh' })
    )
  })

  it.for([-1, 1, 7])(
    'CP-34: a roll of %s, outside 0 to 1, still picks a reaction other than the last',
    (roll) => {
      const picked = pickReaction({ roll, last: 'oh' })

      expect(REACTIONS).toContain(picked)
      expect(picked.id).not.toBe('oh')
    }
  )
})

describe('reactionFrame', () => {
  const giggle = reactionNamed('giggle')
  const at = (elapsedMs: number) =>
    reactionFrame({ reaction: giggle, elapsedMs, reducedMotion: false })
  const stillAt = (elapsedMs: number) =>
    reactionFrame({ reaction: giggle, elapsedMs, reducedMotion: true })

  it('CP-33: goes through its frames in turn, and stays on the last when it is over', () => {
    const [first, second, third] = giggle.beats

    expect(at(0)).toBe(first.frame)
    expect(at(first.ms - 1)).toBe(first.frame)
    expect(at(first.ms)).toBe(second.frame)
    expect(at(first.ms + second.ms)).toBe(third.frame)
    expect(at(reactionDuration(giggle) + 500)).toBe(
      giggle.beats[giggle.beats.length - 1].frame
    )
  })

  it('CP-38: with reduced motion it is the first frame, held, and no other', () => {
    const seen = new Set<string>()
    for (
      let elapsedMs = 0;
      elapsedMs <= reactionDuration(giggle);
      elapsedMs += 10
    )
      seen.add(stillAt(elapsedMs))

    expect(seen).toEqual(new Set([giggle.beats[0].frame]))
  })
})
