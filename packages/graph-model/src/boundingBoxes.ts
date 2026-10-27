import type { Bounds } from '@comfyorg/shared-frontend-utils/geometry'
type RegionType = 'obj' | 'text'

export interface BoundingBoxMetadata {
  type: RegionType
  text: string
  desc: string
  palette: string[]
}

export interface BoundingBox extends Bounds {
  metadata: BoundingBoxMetadata
}
