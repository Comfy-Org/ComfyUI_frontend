import { describe, expect, it } from 'vitest'

import type { CompanionFrame } from './companionArt'
import {
  TALK_FRAME_MS,
  companionFrame,
  companionLook,
  talkDuration,
  withCompanion
} from './companionPose'
import type { SlotView } from './slotView'

describe('companionLook', () => {
  it.for([
    { phase: 'idle', pose: 'resting' },
    { phase: 'armed', pose: 'resting' },
    { phase: 'marking', pose: 'resting' },
    { phase: 'asking', pose: 'resting' },
    { phase: 'annotating', pose: 'resting' },
    { phase: 'waiting', pose: 'thinking' },
    { phase: 'failed', pose: 'resting' }
  ] as const)(
    'CP-01, CP-04, CP-13: in the $phase phase she is at the dock and $pose',
    ({ phase, pose }) => {
      expect(
        companionLook({ phase, target: 'none', followUpWaiting: false })
      ).toEqual({ goes: 'dock', pose })
    }
  )

  it('CP-06: while an answer points at something in view she goes to it and points', () => {
    expect(
      companionLook({
        phase: 'guiding',
        target: 'shown',
        followUpWaiting: false
      })
    ).toEqual({ goes: 'target', pose: 'pointing' })
  })

  it('CP-08: while the target of the step is off screen she stays where she is', () => {
    expect(
      companionLook({
        phase: 'guiding',
        target: 'hidden',
        followUpWaiting: false
      })
    ).toEqual({ goes: 'stay', pose: 'thinking' })
  })

  it('CP-17: a step that points at nothing sends her home', () => {
    expect(
      companionLook({
        phase: 'guiding',
        target: 'none',
        followUpWaiting: false
      })
    ).toEqual({ goes: 'dock', pose: 'resting' })
  })

  it.for([
    { target: 'shown', goes: 'target' },
    { target: 'hidden', goes: 'stay' },
    { target: 'none', goes: 'dock' }
  ] as const)(
    'CP-26: while a follow-up waits she keeps where the step puts her ($goes) and thinks instead of pointing, whatever the target is ($target)',
    ({ target, goes }) => {
      expect(
        companionLook({ phase: 'guiding', target, followUpWaiting: true })
      ).toEqual({ goes, pose: 'thinking' })
    }
  )
})

describe('withCompanion', () => {
  it.for<SlotView>([{ kind: 'waiting' }, { kind: 'hint' }])(
    'CP-04, CP-40: she says the $kind line, so the Ask slot does not',
    (slot) => {
      expect(withCompanion(slot)).toEqual({
        slot: { kind: 'none' },
        says: slot.kind
      })
    }
  )

  it.for<SlotView>([
    { kind: 'none' },
    { kind: 'summary' },
    { kind: 'failure' },
    { kind: 'noThinking' },
    { kind: 'questions' },
    { kind: 'thinking', tall: false }
  ])(
    'CP-05, CP-13: leaves the $kind slot alone, and she says nothing',
    (slot) => {
      expect(withCompanion(slot)).toEqual({ slot, says: null })
    }
  )
})

describe('talkDuration', () => {
  it('CP-18: is about as long as it takes to say the line, within a range', () => {
    expect(talkDuration('Thinking…')).toBe(1000)
    expect(talkDuration('x'.repeat(60))).toBe(2700)
    expect(talkDuration('x'.repeat(400))).toBe(4000)
  })
})

describe('companionFrame', () => {
  const resting = {
    pose: 'resting',
    points: 'right',
    travelling: false,
    speakingMs: null,
    reducedMotion: false
  } as const

  it.for<{
    name: string
    facts: Partial<Parameters<typeof companionFrame>[0]>
    expected: CompanionFrame
  }>([
    { name: 'resting shows the idle frame', facts: {}, expected: 'idle' },
    {
      name: 'thinking puts her hand under her chin',
      facts: { pose: 'thinking' },
      expected: 'thinking'
    },
    {
      name: 'pointing right shows the arm toward the right',
      facts: { pose: 'pointing', points: 'right' },
      expected: 'point-right'
    },
    {
      name: 'pointing left shows the arm toward the left',
      facts: { pose: 'pointing', points: 'left' },
      expected: 'point-left'
    },
    {
      name: 'moving shows the delighted frame, whatever she was doing',
      facts: { pose: 'pointing', travelling: true },
      expected: 'happy'
    }
  ])('CP-06, CP-15: $name', ({ facts, expected }) => {
    expect(companionFrame({ ...resting, ...facts })).toBe(expected)
  })

  it('CP-18: a line she says moves her mouth through the frames, then she is back in her pose', () => {
    const at = (speakingMs: number | null) =>
      companionFrame({ ...resting, pose: 'thinking', speakingMs })

    expect(at(0)).toBe('talk-open')
    expect(at(TALK_FRAME_MS)).toBe('talk-wide')
    expect(at(TALK_FRAME_MS * 2)).toBe('talk-open')
    expect(at(TALK_FRAME_MS * 3)).toBe('idle')
    expect(at(TALK_FRAME_MS * 7)).toBe('talk-open')
    expect(at(null)).toBe('thinking')
  })

  it('CP-14: with reduced motion she shows one open-mouth frame for the whole line', () => {
    const at = (speakingMs: number) =>
      companionFrame({
        ...resting,
        reducedMotion: true,
        speakingMs
      })

    expect(at(0)).toBe('talk-open')
    expect(at(TALK_FRAME_MS * 3)).toBe('talk-open')
  })

  it.for<{
    name: string
    facts: Partial<Parameters<typeof companionFrame>[0]>
    expected: CompanionFrame
  }>([
    { name: 'at rest she shows it', facts: {}, expected: 'talk-wide' },
    {
      name: 'flying shows the delighted one',
      facts: { travelling: true },
      expected: 'happy'
    },
    {
      name: 'pointing shows the arm',
      facts: { pose: 'pointing' },
      expected: 'point-right'
    },
    {
      name: 'thinking shows her hand under her chin',
      facts: { pose: 'thinking' },
      expected: 'thinking'
    },
    {
      name: 'a line she says moves her mouth',
      facts: { speakingMs: 0 },
      expected: 'talk-open'
    }
  ])(
    'CP-36: while a reaction is on talk-wide, $name',
    ({ facts, expected }) => {
      expect(
        companionFrame({ ...resting, reacting: 'talk-wide', ...facts })
      ).toBe(expected)
    }
  )
})
