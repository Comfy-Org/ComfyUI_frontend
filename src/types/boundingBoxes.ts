type RegionType = 'obj' | 'text'

export interface BoundingBoxMetadata {
  type: RegionType
  text: string
  desc: string
  palette: string[]
}

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
  metadata: BoundingBoxMetadata
}
