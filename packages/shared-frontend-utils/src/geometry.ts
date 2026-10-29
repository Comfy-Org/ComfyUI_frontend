export interface Point2D {
  x: number
  y: number
}

export interface Size2D {
  width: number
  height: number
}

export interface Bounds extends Point2D, Size2D {}

export interface CompactSize {
  w: number
  h: number
}

export interface CompactRect extends Point2D, CompactSize {}

export interface Extents {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface SizedExtents extends Extents, Size2D {}

export interface MinBounds extends Size2D {
  minX: number
  minY: number
}

export interface RectEdges {
  left: number
  top: number
  right: number
  bottom: number
}

export type ReadOnlyRectEdges = Readonly<RectEdges>
export type RectSide = keyof RectEdges
export type CompassCorners = 'NE' | 'SE' | 'SW' | 'NW'

export interface Vector3 extends Point2D {
  z: number
}

export interface Quaternion extends Vector3 {
  w: number
}

export type PointTuple = [x: number, y: number]
export type SizeTuple = [width: number, height: number]
export type Vector3Tuple = [x: number, y: number, z: number]
export type RectTuple = [x: number, y: number, width: number, height: number]
export type Rect = RectTuple | Float64Array
export type ReadOnlyRect =
  | Readonly<RectTuple>
  | ReadOnlyTypedArray<Float64Array>

export type ReadOnlyTypedArray<T extends Float64Array> = Omit<
  Readonly<T>,
  'fill' | 'copyWithin' | 'reverse' | 'set' | 'sort' | 'subarray'
>

export interface HasBoundingRect {
  readonly boundingRect: ReadOnlyRect
}

export type CubicBezier = readonly [
  PointTuple,
  PointTuple,
  PointTuple,
  PointTuple
]

export interface PanZoom {
  offset: PointTuple
  scale: number
}

export interface PositionedRect {
  pos: PointTuple
  size: SizeTuple
}

export interface PositionConfig extends PositionedRect {
  scale?: number
}

export interface LoosePositionedRect {
  pos?: ArrayLike<number>
  size?: ArrayLike<number>
}
