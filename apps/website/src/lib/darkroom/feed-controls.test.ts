import { describe, expect, it } from 'vitest'

import { settingsChips, shapeLabel } from './chips'
import type { PendingSlot } from './feed'
import { pendingLabel, stepPromptHistory, toggleSelection } from './feed'
import type { DarkroomRequest } from './request'

describe('pendingLabel', () => {
  const slot: PendingSlot = {
    key: 'job:0',
    run: 0,
    seed: 1,
    status: 'pending',
    phase: 'sending',
    startedAt: 10_000
  }
  const cases: [Partial<PendingSlot>, ReturnType<typeof pendingLabel>][] = [
    [{ phase: 'sending' }, { key: 'sending' }],
    [{ phase: 'queued' }, { key: 'nextUp' }],
    [
      { phase: 'queued', ahead: 3 },
      { key: 'inLine', values: { count: 3 } }
    ],
    [{ phase: 'running' }, { key: 'developing', values: { seconds: 4 } }],
    [{ phase: 'saving' }, { key: 'saving' }]
  ]

  it.for(cases)('says where %j stands', ([state, label]) => {
    expect(pendingLabel({ ...slot, ...state }, 14_400)).toEqual(label)
  })
})

describe('stepPromptHistory', () => {
  const history = ['newest', 'older', 'oldest']

  it('starts from the newest prompt in an empty bar', () => {
    expect(stepPromptHistory(history, -1, '', 'older')).toBe(0)
  })

  it('walks back and forth while a past prompt is showing', () => {
    expect(stepPromptHistory(history, 0, 'newest', 'older')).toBe(1)
    expect(stepPromptHistory(history, 1, 'older', 'newer')).toBe(0)
    expect(stepPromptHistory(history, 0, 'newest', 'newer')).toBe(-1)
  })

  it('stops at the oldest prompt', () => {
    expect(stepPromptHistory(history, 2, 'oldest', 'older')).toBeUndefined()
  })

  it('leaves alone what the reader is typing', () => {
    expect(stepPromptHistory(history, -1, 'a draft', 'older')).toBeUndefined()
    expect(
      stepPromptHistory(history, 0, 'newest, edited', 'older')
    ).toBeUndefined()
  })
})

describe('toggleSelection', () => {
  const ids = ['a', 'b', 'c', 'd']

  it('flips the image that was clicked', () => {
    expect([...toggleSelection(new Set(), ids, 1)]).toEqual(['b'])
    expect([...toggleSelection(new Set(['b']), ids, 1)]).toEqual([])
  })

  it('selects the range on a Shift-click, in either direction', () => {
    expect([...toggleSelection(new Set(['a']), ids, 2, 0)]).toEqual([
      'a',
      'b',
      'c'
    ])
    expect([...toggleSelection(new Set(['d']), ids, 1, 3)]).toEqual([
      'd',
      'b',
      'c'
    ])
  })
})

describe('settingsChips', () => {
  // Stands in for the catalog: the key, then any values it was given.
  const t = (key: string, values?: Record<string, string | number>) =>
    values ? `${key} ${JSON.stringify(values)}` : key

  const request: DarkroomRequest = {
    prompt: 'a fox',
    model: 'vertexai/gemini-nano-banana-2.1',
    aspectRatio: '16:9',
    imageSize: '2K',
    mimeType: 'image/png',
    temperature: 1,
    seed: 100,
    jobId: 'job',
    run: 0,
    runs: 2,
    inputCount: 0
  }
  const extras = { created: 0, locale: 'en', seeds: [100, 101] }

  it('names the model, shape, size and seeds of a plain row', () => {
    const chips = settingsChips(t, request, extras)
    expect(chips.slice(0, 4)).toEqual([
      'Nano Banana 2.1',
      'darkroom.shapes.wide 16:9',
      '2K',
      'darkroom.chips.seedRange {"first":100,"last":101}'
    ])
    expect(chips).toHaveLength(5)
  })

  it('adds only the settings that were changed', () => {
    const chips = settingsChips(
      t,
      {
        ...request,
        model: 'vertexai/gemini-2.5-flash-image',
        aspectRatio: 'auto',
        mimeType: 'image/jpeg',
        temperature: 1.6,
        thinkingLevel: 'HIGH',
        system: 'soft grain',
        moodboard: { id: 'b', name: 'Dusk', count: 3 }
      },
      { ...extras, seeds: [7], seconds: 5.9, notes: true }
    )
    expect(chips).toEqual([
      'Nano Banana',
      'darkroom.chips.moodboard {"name":"Dusk"}',
      'darkroom.shapes.autoName',
      // The model with one resolution shows none.
      'darkroom.chips.seed {"seed":7}',
      'darkroom.chips.creativity {"word":"darkroom.creativity.wild","value":1.6}',
      'darkroom.chips.planning {"level":"darkroom.planning.careful"}',
      'JPEG',
      'darkroom.chips.notes',
      'darkroom.chips.seconds {"seconds":5.9}',
      expect.any(String)
    ])
  })

  it('shows an unknown shape as it was sent', () => {
    expect(shapeLabel(t, '5:4')).toBe('5:4')
  })
})
