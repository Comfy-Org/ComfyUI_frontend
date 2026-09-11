import { describe, expect, it } from 'vitest'

import { transitionDiscovery } from './firstRunDiscovery'
import type { DiscoveryState } from './firstRunDiscovery'
import { SUGGESTIONS } from './firstRunSuggestions'

const image = { filename: 'result.png' }

describe('discovery event ordering', () => {
  it.for([
    ['catalog', 'success', 'output'],
    ['catalog', 'output', 'success'],
    ['success', 'catalog', 'output'],
    ['success', 'output', 'catalog'],
    ['output', 'catalog', 'success'],
    ['output', 'success', 'catalog']
  ])(
    'waits for success and renders late output before the impression: %j',
    (events) => {
      let state: DiscoveryState = transitionDiscovery(
        { phase: 'dormant' },
        {
          type: 'tour-ended',
          completedAt: null,
          output: null,
          screenClear: true
        },
        0
      )
      let completedAt: number | null = null
      let output: typeof image | null = null
      for (const event of events) {
        if (event === 'catalog')
          state = transitionDiscovery(
            state,
            { type: 'catalog-settled', suggestions: SUGGESTIONS },
            500
          )
        else {
          if (event === 'success') completedAt = 500
          else output = image
          state = transitionDiscovery(
            state,
            { type: 'context-changed', completedAt, output, screenClear: true },
            500
          )
        }
        expect(state.phase).toBe('waiting')
      }
      state = transitionDiscovery(state, { type: 'appearance-due' }, 1999)
      expect(state.phase).toBe('waiting')
      state = transitionDiscovery(state, { type: 'appearance-due' }, 2000)
      expect(state).toEqual({
        phase: 'shown',
        input: image,
        suggestions: SUGGESTIONS,
        screenClear: true
      })
    }
  )

  it('uses an atomic context snapshot when output arrives as a dialog closes', () => {
    let state = transitionDiscovery(
      { phase: 'dormant' },
      { type: 'tour-ended', completedAt: 0, output: null, screenClear: false },
      2000
    )
    state = transitionDiscovery(
      state,
      { type: 'catalog-settled', suggestions: SUGGESTIONS },
      2000
    )
    state = transitionDiscovery(
      state,
      {
        type: 'context-changed',
        completedAt: 0,
        output: image,
        screenClear: true
      },
      2000
    )
    expect(state).toMatchObject({
      phase: 'shown',
      input: image,
      suggestions: SUGGESTIONS
    })
  })

  it('freezes the first catalog decision and impression across late events', () => {
    let state = transitionDiscovery(
      { phase: 'dormant' },
      { type: 'tour-ended', completedAt: 0, output: image, screenClear: false },
      2000
    )
    state = transitionDiscovery(
      state,
      { type: 'catalog-settled', suggestions: [] },
      3000
    )
    state = transitionDiscovery(
      state,
      { type: 'catalog-settled', suggestions: SUGGESTIONS },
      4000
    )
    state = transitionDiscovery(
      state,
      {
        type: 'context-changed',
        completedAt: 0,
        output: image,
        screenClear: true
      },
      4000
    )
    expect(state).toMatchObject({ phase: 'shown', suggestions: [] })
    state = transitionDiscovery(
      state,
      {
        type: 'context-changed',
        completedAt: 0,
        output: { filename: 'replacement.png' },
        screenClear: false
      },
      5000
    )
    expect(state).toMatchObject({
      phase: 'shown',
      input: image,
      suggestions: [],
      screenClear: false
    })
    state = transitionDiscovery(state, { type: 'reset' }, 5000)
    expect(
      transitionDiscovery(
        state,
        { type: 'catalog-settled', suggestions: SUGGESTIONS },
        6000
      )
    ).toEqual({ phase: 'dormant' })
  })
})
