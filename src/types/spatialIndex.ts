import type { Bounds } from '@comfyorg/shared-frontend-utils/geometry'

/**
 * Debug information for a single QuadTree node
 */
export interface QuadNodeDebugInfo {
  bounds: Bounds
  depth: number
  itemCount: number
  divided: boolean
  children?: QuadNodeDebugInfo[]
}

/**
 * Debug information for the entire spatial index
 */
export interface SpatialIndexDebugInfo {
  size: number
  tree: QuadNodeDebugInfo
}
