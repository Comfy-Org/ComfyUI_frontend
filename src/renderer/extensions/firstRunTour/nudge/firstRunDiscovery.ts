import type { ResultItem } from '@/schemas/apiSchema'

import type { Suggestion } from './firstRunSuggestions'

export const DISCOVERY_APPEAR_DELAY_MS = 1500
export const DISCOVERY_CATALOG_WAIT_MS = 3000

export type DiscoveryState =
  | { phase: 'dormant' }
  | {
      phase: 'waiting'
      catalog:
        | { phase: 'loading' }
        | { phase: 'ready'; suggestions: Suggestion[] }
      completedAt: number | null
      output: ResultItem | null
      screenClear: boolean
    }
  | {
      phase: 'shown'
      suggestions: Suggestion[]
      input: ResultItem | null
      screenClear: boolean
    }

export type DiscoveryEvent =
  | { type: 'reset' }
  | {
      type: 'tour-ended'
      completedAt: number | null
      output: ResultItem | null
      screenClear: boolean
    }
  | {
      type: 'context-changed'
      completedAt: number | null
      output: ResultItem | null
      screenClear: boolean
    }
  | { type: 'catalog-settled'; suggestions: Suggestion[] }
  | { type: 'appearance-due' }

function transition(
  state: DiscoveryState,
  event: DiscoveryEvent
): DiscoveryState {
  if (event.type === 'reset') return { phase: 'dormant' }
  if (event.type === 'tour-ended')
    return state.phase === 'dormant'
      ? {
          phase: 'waiting',
          catalog: { phase: 'loading' },
          completedAt: event.completedAt,
          output: event.output,
          screenClear: event.screenClear
        }
      : state
  if (state.phase === 'dormant') return state
  if (event.type === 'context-changed')
    return state.phase === 'shown'
      ? { ...state, screenClear: event.screenClear }
      : {
          ...state,
          completedAt: event.completedAt,
          output: event.output,
          screenClear: event.screenClear
        }
  if (state.phase === 'shown') return state
  if (event.type === 'catalog-settled' && state.catalog.phase === 'loading')
    return {
      ...state,
      catalog: { phase: 'ready', suggestions: event.suggestions }
    }
  return state
}

export function transitionDiscovery(
  previous: DiscoveryState,
  event: DiscoveryEvent,
  now: number
): DiscoveryState {
  const state = transition(previous, event)
  if (
    state.phase !== 'waiting' ||
    state.catalog.phase !== 'ready' ||
    state.completedAt === null ||
    now < state.completedAt + DISCOVERY_APPEAR_DELAY_MS ||
    !state.screenClear
  )
    return state
  return {
    phase: 'shown',
    suggestions: state.output ? state.catalog.suggestions : [],
    input: state.output,
    screenClear: state.screenClear
  }
}
