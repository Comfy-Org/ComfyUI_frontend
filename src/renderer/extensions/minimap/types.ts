import type {
  Size2D,
  MinBounds,
  Bounds,
  PanZoom
} from '@comfyorg/shared-frontend-utils/geometry'
/**
 * Minimap-specific type definitions
 */
import type { LGraph } from '@comfyorg/litegraph/litegraph'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import type { ResolvedMinimapNodeDecoration } from '@/platform/canvas/minimapDecorationRegistry'

/**
 * Minimal interface for what the minimap needs from the canvas
 */
export interface MinimapCanvas {
  canvas: HTMLCanvasElement
  dpr: number
  ds: PanZoom
  graph?: LGraph | null
  setDirty: (fg?: boolean, bg?: boolean) => void
}

export interface MinimapRenderContext extends Size2D {
  bounds: MinBounds
  scale: number
  settings: MinimapRenderSettings
  decorations?: readonly ResolvedMinimapNodeDecoration[]
  nodeProgressStates?: MinimapNodeProgressStates
  now?: number
}

export type MinimapNodeExecutionState =
  | 'pending'
  | 'running'
  | 'finished'
  | 'error'

export type MinimapNodeProgressStates = Record<
  NodeLocatorId,
  { state: MinimapNodeExecutionState }
>

interface MinimapRenderSettings {
  nodeColors: boolean
  showLinks: boolean
  showGroups: boolean
  renderBypass: boolean
  renderError: boolean
}

export interface UpdateFlags {
  bounds: boolean
  nodes: boolean
  connections: boolean
  viewport: boolean
}

export type MinimapSettingsKey =
  | 'Comfy.Minimap.NodeColors'
  | 'Comfy.Minimap.ShowLinks'
  | 'Comfy.Minimap.ShowGroups'
  | 'Comfy.Minimap.RenderBypassState'
  | 'Comfy.Minimap.RenderErrorState'

/**
 * Node data required for minimap rendering
 */
export interface MinimapNodeData extends Bounds {
  id: NodeId
  bgcolor?: string
  mode?: number
  hasErrors?: boolean
  executionState?: MinimapNodeExecutionState | null
}

/**
 * Link data required for minimap rendering
 */
export interface MinimapLinkData {
  sourceNode: MinimapNodeData
  targetNode: MinimapNodeData
  sourceSlot: number
  targetSlot: number
}

/**
 * Group data required for minimap rendering
 */
export interface MinimapGroupData extends Bounds {
  color?: string
}
