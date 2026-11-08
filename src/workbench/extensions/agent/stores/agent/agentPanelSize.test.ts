import { describe, expect, it } from 'vitest'

import {
  reduceAgentPanelSize,
  resolveAgentPanelPresentation
} from './agentPanelSize'
import type {
  AgentPanelPresentation,
  AgentPanelSize,
  AgentPanelSizeEvent
} from './agentPanelSize'

const EVENTS = {
  expandWithoutFullscreen: {
    type: 'expandToggled',
    fullscreenAvailable: false
  },
  expandWithFullscreen: { type: 'expandToggled', fullscreenAvailable: true },
  fullscreenRestored: { type: 'fullscreenRestored' },
  fullscreenExited: { type: 'fullscreenExited', reason: 'graph_reveal' },
  widthDragged: { type: 'widthDragged' },
  panelClosed: { type: 'panelClosed' }
} as const satisfies Record<string, AgentPanelSizeEvent>

type Mode = AgentPanelSize['mode']
type EventName = keyof typeof EVENTS

/** The mode each pair lands in; the starting mode means the event is refused. */
const TRANSITIONS: Record<Mode, Record<EventName, Mode>> = {
  docked: {
    expandWithoutFullscreen: 'wide',
    expandWithFullscreen: 'fullscreen',
    fullscreenRestored: 'fullscreen',
    fullscreenExited: 'docked',
    widthDragged: 'docked',
    panelClosed: 'docked'
  },
  wide: {
    expandWithoutFullscreen: 'docked',
    expandWithFullscreen: 'fullscreen',
    fullscreenRestored: 'wide',
    fullscreenExited: 'wide',
    widthDragged: 'docked',
    panelClosed: 'wide'
  },
  fullscreen: {
    expandWithoutFullscreen: 'docked',
    expandWithFullscreen: 'docked',
    fullscreenRestored: 'fullscreen',
    fullscreenExited: 'docked',
    widthDragged: 'fullscreen',
    panelClosed: 'docked'
  }
}

const modes = Object.keys(TRANSITIONS) as Mode[]
const eventNames = Object.keys(EVENTS) as EventName[]
const pairs = modes.flatMap((from) =>
  eventNames.map((event) => ({ from, event, to: TRANSITIONS[from][event] }))
)

describe('reduceAgentPanelSize', () => {
  it.for(pairs)('$from on $event lands in $to', ({ from, event, to }) => {
    expect(reduceAgentPanelSize({ mode: from }, EVENTS[event])).toEqual({
      mode: to
    })
  })

  it.for(pairs.filter(({ from, to }) => from === to))(
    '$from on $event returns the state it was given',
    ({ from, event }) => {
      const state: AgentPanelSize = { mode: from }

      expect(reduceAgentPanelSize(state, EVENTS[event])).toBe(state)
    }
  )
})

describe('resolveAgentPanelPresentation', () => {
  /** Side toolbar rail + sidebar minimum. */
  const SIDEBAR_OPEN = 368
  /** Side toolbar rail alone, with no sidebar tab showing. */
  const SIDEBAR_CLOSED = 56

  const cases: {
    name: string
    input: Parameters<typeof resolveAgentPanelPresentation>[0]
    expected: AgentPanelPresentation
  }[] = [
    {
      name: 'hides a panel that is not visible',
      input: {
        visible: false,
        size: { mode: 'docked' },
        windowWidth: 1920,
        draggedWidth: 420,
        reservedWorkspaceWidth: SIDEBAR_OPEN
      },
      expected: { kind: 'hidden' }
    },
    {
      name: 'hides a full screen panel that is not visible',
      input: {
        visible: false,
        size: { mode: 'fullscreen' },
        windowWidth: 1920,
        draggedWidth: 420,
        reservedWorkspaceWidth: SIDEBAR_OPEN
      },
      expected: { kind: 'hidden' }
    },
    {
      name: 'keeps full screen in a window too narrow to dock',
      input: {
        visible: true,
        size: { mode: 'fullscreen' },
        windowWidth: 600,
        draggedWidth: 420,
        reservedWorkspaceWidth: SIDEBAR_OPEN
      },
      expected: { kind: 'fullscreen' }
    },
    {
      name: 'docks at the dragged width when the window has room',
      input: {
        visible: true,
        size: { mode: 'docked' },
        windowWidth: 1920,
        draggedWidth: 700,
        reservedWorkspaceWidth: SIDEBAR_OPEN
      },
      expected: { kind: 'docked', width: 700 }
    },
    {
      name: 'docks a wide panel at 960 whatever width was dragged',
      input: {
        visible: true,
        size: { mode: 'wide' },
        windowWidth: 1920,
        draggedWidth: 700,
        reservedWorkspaceWidth: SIDEBAR_OPEN
      },
      expected: { kind: 'docked', width: 960 }
    },
    {
      name: 'overlays when the window only just fits the panel and workspace',
      input: {
        visible: true,
        size: { mode: 'docked' },
        windowWidth: 788,
        draggedWidth: 420,
        reservedWorkspaceWidth: SIDEBAR_OPEN
      },
      expected: { kind: 'overlay', width: 420 }
    },
    {
      name: 'docks one pixel past that fit',
      input: {
        visible: true,
        size: { mode: 'docked' },
        windowWidth: 789,
        draggedWidth: 420,
        reservedWorkspaceWidth: SIDEBAR_OPEN
      },
      expected: { kind: 'docked', width: 420 }
    },
    {
      name: 'overlays a wide panel at 960 when the window only just fits it',
      input: {
        visible: true,
        size: { mode: 'wide' },
        windowWidth: 1016,
        draggedWidth: 420,
        reservedWorkspaceWidth: SIDEBAR_CLOSED
      },
      expected: { kind: 'overlay', width: 960 }
    },
    {
      name: 'docks a wide panel one pixel past that fit',
      input: {
        visible: true,
        size: { mode: 'wide' },
        windowWidth: 1017,
        draggedWidth: 420,
        reservedWorkspaceWidth: SIDEBAR_CLOSED
      },
      expected: { kind: 'docked', width: 960 }
    },
    {
      name: 'overlays at the requested width in a window narrower than it',
      input: {
        visible: true,
        size: { mode: 'wide' },
        windowWidth: 600,
        draggedWidth: 420,
        reservedWorkspaceWidth: SIDEBAR_OPEN
      },
      expected: { kind: 'overlay', width: 960 }
    },
    {
      name: 'caps a docked width at 960',
      input: {
        visible: true,
        size: { mode: 'docked' },
        windowWidth: 3000,
        draggedWidth: 1200,
        reservedWorkspaceWidth: SIDEBAR_CLOSED
      },
      expected: { kind: 'docked', width: 960 }
    }
  ]

  it.for(cases)('$name', ({ input, expected }) => {
    expect(resolveAgentPanelPresentation(input)).toEqual(expected)
  })
})
