export type AgentGraphBuildPlaybackState =
  | { phase: 'idle' }
  | { phase: 'queued'; total: number }
  | {
      phase: 'playing' | 'paused'
      current: number
      total: number
      nodeLabel: string
      cursorX: number
      cursorY: number
    }
  | { phase: 'complete'; current: number; total: number }

export type AgentGraphBuildPlaybackEvent =
  | { type: 'staged' }
  | { type: 'started'; nodeLabel: string }
  | { type: 'cursorMoved'; x: number; y: number }
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
          cursorX: 0,
          cursorY: 0
        }
      if (state.phase !== 'playing') return state
      return {
        ...state,
        current: state.current + 1,
        nodeLabel: event.nodeLabel
      }
    case 'cursorMoved':
      if (state.phase !== 'playing' && state.phase !== 'paused') return state
      return { ...state, cursorX: event.x, cursorY: event.y }
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
