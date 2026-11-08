import { clamp } from 'es-toolkit'

export const PANEL_MIN_WIDTH = 420
export const PANEL_MAX_WIDTH = 960

export type AgentPanelSize =
  | { mode: 'docked' }
  | { mode: 'wide' }
  | { mode: 'fullscreen' }

export type FullscreenExitReason =
  | 'size_toggle'
  | 'panel_closed'
  | 'graph_reveal'
  | 'flag_off'
  | 'tour'
  | 'user_changed'
  | 'narrow_window'
  | 'load_failed'
  | 'view_errors'

export type AgentPanelSizeEvent =
  | { type: 'expandToggled'; fullscreenAvailable: boolean }
  | { type: 'fullscreenRestored' }
  | { type: 'fullscreenExited'; reason: FullscreenExitReason }
  | { type: 'widthDragged' }
  | { type: 'panelClosed' }

export type AgentPanelPresentation =
  | { kind: 'hidden' }
  | { kind: 'docked'; width: number }
  | { kind: 'overlay'; width: number }
  | { kind: 'fullscreen' }

export function reduceAgentPanelSize(
  state: AgentPanelSize,
  event: AgentPanelSizeEvent
): AgentPanelSize {
  switch (event.type) {
    case 'expandToggled':
      if (state.mode === 'fullscreen') return { mode: 'docked' }
      if (event.fullscreenAvailable) return { mode: 'fullscreen' }
      return state.mode === 'wide' ? { mode: 'docked' } : { mode: 'wide' }
    case 'fullscreenRestored':
      return state.mode === 'docked' ? { mode: 'fullscreen' } : state
    case 'fullscreenExited':
    case 'panelClosed':
      return state.mode === 'fullscreen' ? { mode: 'docked' } : state
    case 'widthDragged':
      return state.mode === 'wide' ? { mode: 'docked' } : state
  }
}

export function resolveAgentPanelPresentation({
  visible,
  size,
  windowWidth,
  draggedWidth,
  reservedWorkspaceWidth
}: {
  visible: boolean
  size: AgentPanelSize
  windowWidth: number
  draggedWidth: number
  reservedWorkspaceWidth: number
}): AgentPanelPresentation {
  if (!visible) return { kind: 'hidden' }
  if (size.mode === 'fullscreen') return { kind: 'fullscreen' }

  const requestedWidth = size.mode === 'wide' ? PANEL_MAX_WIDTH : draggedWidth
  if (windowWidth <= requestedWidth + reservedWorkspaceWidth)
    return { kind: 'overlay', width: requestedWidth }

  const maxWidth = clamp(
    windowWidth - reservedWorkspaceWidth,
    0,
    PANEL_MAX_WIDTH
  )
  return { kind: 'docked', width: Math.min(maxWidth, requestedWidth) }
}

export interface PersistedAgentPanelSize {
  mode: 'fullscreen'
  owner: string
}

export function parsePersistedAgentPanelSize(
  raw: string | null
): PersistedAgentPanelSize | null {
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const mode = 'mode' in parsed ? parsed.mode : undefined
  const owner = 'owner' in parsed ? parsed.owner : undefined
  if (mode !== 'fullscreen' || typeof owner !== 'string' || owner === '')
    return null
  return { mode, owner }
}

export function serializeAgentPanelSize(
  size: AgentPanelSize,
  owner: string | undefined
): string | null {
  if (size.mode !== 'fullscreen' || !owner) return null
  const persisted: PersistedAgentPanelSize = { mode: 'fullscreen', owner }
  return JSON.stringify(persisted)
}

export interface StartupSizeInput {
  persisted: PersistedAgentPanelSize | null
  userId: string | undefined
  redesign: boolean
  panelVisible: boolean
  startupDecided: boolean
  screenHeld: boolean
  urlClaimsGraph: boolean
}

export function shouldRestoreFullscreen({
  persisted,
  userId,
  redesign,
  panelVisible,
  startupDecided,
  screenHeld,
  urlClaimsGraph
}: StartupSizeInput): boolean {
  return (
    persisted !== null &&
    persisted.owner === userId &&
    redesign &&
    panelVisible &&
    startupDecided &&
    !screenHeld &&
    !urlClaimsGraph
  )
}
