import { describe, expect, it } from 'vitest'

import { reduceOutputsTray } from './agentOutputsTray'
import type { OutputsTrayEvent, OutputsTrayState } from './agentOutputsTray'

type OpenTray = Extract<OutputsTrayState, { phase: 'open' }>

const CLOSED: OutputsTrayState = { phase: 'closed' }

function openTray(overrides: Partial<OpenTray> = {}): OpenTray {
  return {
    phase: 'open',
    selected: new Set(['a', 'b']),
    revealed: 60,
    more: 'idle',
    ...overrides
  }
}

interface Transition {
  name: string
  state: OutputsTrayState
  event: OutputsTrayEvent
  expected: OutputsTrayState
}

const TRANSITIONS: Transition[] = [
  {
    name: 'opening a closed tray shows the first page with nothing ticked',
    state: CLOSED,
    event: { type: 'opened' },
    expected: { phase: 'open', selected: new Set(), revealed: 30, more: 'idle' }
  },
  {
    name: 'closing an open tray drops its selection and paging',
    state: openTray(),
    event: { type: 'closed' },
    expected: { phase: 'closed' }
  },
  {
    name: 'toggling an unticked tile ticks it',
    state: openTray(),
    event: { type: 'tileToggled', key: 'c' },
    expected: openTray({ selected: new Set(['a', 'b', 'c']) })
  },
  {
    name: 'toggling a ticked tile unticks it',
    state: openTray(),
    event: { type: 'tileToggled', key: 'a' },
    expected: openTray({ selected: new Set(['b']) })
  },
  {
    name: 'clearing the selection keeps the tray open on the same page',
    state: openTray(),
    event: { type: 'selectionCleared' },
    expected: openTray({ selected: new Set() })
  },
  {
    name: 'revealing more shows one more page',
    state: openTray(),
    event: { type: 'moreRevealed' },
    expected: openTray({ revealed: 90 })
  },
  {
    name: 'requesting more marks the next page as loading',
    state: openTray(),
    event: { type: 'moreRequested' },
    expected: openTray({ more: 'loading' })
  },
  {
    name: 'requesting more after a failure tries again',
    state: openTray({ more: 'failed' }),
    event: { type: 'moreRequested' },
    expected: openTray({ more: 'loading' })
  },
  {
    name: 'a load that brought more outputs shows one more page',
    state: openTray({ more: 'loading' }),
    event: { type: 'moreLoaded', advanced: true },
    expected: openTray({ revealed: 90, more: 'idle' })
  },
  {
    name: 'a load that brought nothing fails on the same page',
    state: openTray({ more: 'loading' }),
    event: { type: 'moreLoaded', advanced: false },
    expected: openTray({ more: 'failed' })
  },
  {
    name: 'adding the ticked tiles closes the tray',
    state: openTray(),
    event: { type: 'added' },
    expected: { phase: 'closed' }
  },
  {
    name: 'downloading the ticked tiles clears them and keeps the tray open',
    state: openTray({ more: 'failed' }),
    event: { type: 'downloaded' },
    expected: openTray({ selected: new Set(), more: 'failed' })
  }
]

interface Refusal {
  name: string
  state: OutputsTrayState
  event: OutputsTrayEvent
}

const REFUSALS: Refusal[] = [
  { name: 'closed ignores closed', state: CLOSED, event: { type: 'closed' } },
  {
    name: 'closed ignores tileToggled',
    state: CLOSED,
    event: { type: 'tileToggled', key: 'a' }
  },
  {
    name: 'closed ignores selectionCleared',
    state: CLOSED,
    event: { type: 'selectionCleared' }
  },
  {
    name: 'closed ignores moreRevealed',
    state: CLOSED,
    event: { type: 'moreRevealed' }
  },
  {
    name: 'closed ignores moreRequested',
    state: CLOSED,
    event: { type: 'moreRequested' }
  },
  {
    name: 'closed ignores a moreLoaded that advanced',
    state: CLOSED,
    event: { type: 'moreLoaded', advanced: true }
  },
  {
    name: 'closed ignores a moreLoaded that did not advance',
    state: CLOSED,
    event: { type: 'moreLoaded', advanced: false }
  },
  { name: 'closed ignores added', state: CLOSED, event: { type: 'added' } },
  {
    name: 'closed ignores downloaded',
    state: CLOSED,
    event: { type: 'downloaded' }
  },
  {
    name: 'open ignores opened, keeping its selection and paging',
    state: openTray({ more: 'loading' }),
    event: { type: 'opened' }
  }
]

describe('reduceOutputsTray', () => {
  it.for(TRANSITIONS)('$name', ({ state, event, expected }) => {
    expect(reduceOutputsTray(state, event)).toEqual(expected)
  })

  it.for(REFUSALS)('$name', ({ state, event }) => {
    expect(reduceOutputsTray(state, event)).toBe(state)
  })

  it.for(TRANSITIONS)(
    '$name without changing the state it was given',
    ({ state, event }) => {
      const before = structuredClone(state)

      reduceOutputsTray(state, event)

      expect(state).toEqual(before)
    }
  )
})
