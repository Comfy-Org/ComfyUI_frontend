/**
 * Minimap-specific type definitions
 */
import type { LGraph } from '@/lib/litegraph/src/litegraph'

/**
 * Minimal interface for what the minimap needs from the canvas
 */
export interface MinimapCanvas {
  canvas: HTMLCanvasElement
  ds: {
    scale: number
    offset: [number, number]
  }
  graph?: LGraph | null
  setDirty: (fg?: boolean, bg?: boolean) => void
}

export interface MinimapRenderContext {
  bounds: {
    minX: number
    minY: number
    width: number
    height: number
  }
  scale: number
  settings: MinimapRenderSettings
  width: number
  height: number
}

export interface MinimapRenderSettings {
  nodeColors: boolean
  showLinks: boolean
  showGroups: boolean
  renderBypass: boolean
  renderError: boolean
}

export interface MinimapBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

export interface ViewportTransform {
  x: number
  y: number
  width: number
  height: number
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
