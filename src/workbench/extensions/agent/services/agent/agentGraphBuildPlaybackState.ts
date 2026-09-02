export interface AgentGraphBuildConnectionSegment {
  startX: number
  startY: number
  endX: number
  endY: number
}

type AgentGraphBuildAction = 'selecting' | 'dragging' | 'connecting'

export type AgentGraphBuildPlaybackState =
  | { phase: 'idle' }
  | { phase: 'queued'; total: number }
  | {
      phase: 'playing' | 'paused'
      current: number
      total: number
      nodeLabel: string
      action: AgentGraphBuildAction
      cursorX: number
      cursorY: number
      activeConnection: AgentGraphBuildConnectionSegment | null
      completedConnections: AgentGraphBuildConnectionSegment[]
    }
  | { phase: 'complete'; current: number; total: number }

export type AgentGraphBuildPlaybackEvent =
  | { type: 'staged' }
  | {
      type: 'started'
      nodeLabel: string
      action: AgentGraphBuildAction
    }
  | { type: 'actionChanged'; action: AgentGraphBuildAction }
  | { type: 'cursorMoved'; x: number; y: number }
  | { type: 'connectionStarted'; x: number; y: number }
  | { type: 'connectionCompleted' }
  | { type: 'paused' }
  | { type: 'resumed' }
  | { type: 'completed' }
  | { type: 'reset' }

export const initialAgentGraphBuildPlaybackState: AgentGraphBuildPlaybackState =
  { phase: 'idle' }

export function reduceAgentGraphBuildPlayback(
  state: AgentGraphBuildPlaybackState,
  event: AgentGraphBuildPlaybackEvent
): AgentGraphBuildPlaybackState {
  switch (event.type) {
    case 'staged':
      if (state.phase === 'idle' || state.phase === 'complete')
        return { phase: 'queued', total: 1 }
      return { ...state, total: state.total + 1 }
    case 'started':
      if (state.phase === 'queued')
        return {
          phase: 'playing',
          current: 1,
          total: state.total,
          nodeLabel: event.nodeLabel,
          action: event.action,
          cursorX: 0,
          cursorY: 0,
          activeConnection: null,
          completedConnections: []
        }
      if (state.phase !== 'playing') return state
      return {
        ...state,
        current: state.current + 1,
        nodeLabel: event.nodeLabel,
        action: event.action,
        activeConnection: null
      }
    case 'actionChanged':
      if (state.phase !== 'playing' && state.phase !== 'paused') return state
      return { ...state, action: event.action }
    case 'cursorMoved':
      if (state.phase !== 'playing' && state.phase !== 'paused') return state
      return {
        ...state,
        cursorX: event.x,
        cursorY: event.y,
        activeConnection:
          state.activeConnection === null
            ? null
            : {
                ...state.activeConnection,
                endX: event.x,
                endY: event.y
              }
      }
    case 'connectionStarted':
      if (state.phase !== 'playing' && state.phase !== 'paused') return state
      return {
        ...state,
        activeConnection: {
          startX: event.x,
          startY: event.y,
          endX: event.x,
          endY: event.y
        }
      }
    case 'connectionCompleted':
      if (
        (state.phase !== 'playing' && state.phase !== 'paused') ||
        state.activeConnection === null
      )
        return state
      return {
        ...state,
        completedConnections: [
          ...state.completedConnections,
          state.activeConnection
        ],
        activeConnection: null
      }
    case 'paused':
      return state.phase === 'playing' ? { ...state, phase: 'paused' } : state
    case 'resumed':
      return state.phase === 'paused' ? { ...state, phase: 'playing' } : state
    case 'completed':
      if (state.phase === 'queued')
        return { phase: 'complete', current: 0, total: state.total }
      if (state.phase !== 'playing' && state.phase !== 'paused') return state
      return {
        phase: 'complete',
        current: state.current,
        total: state.total
      }
    case 'reset':
      return initialAgentGraphBuildPlaybackState
  }
}
