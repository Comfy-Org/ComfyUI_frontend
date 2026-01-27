/** A point represented as `[x, y]` co-ordinates */
export type Point = [x: number, y: number]

/** A size represented as `[width, height]` */
export type Size = [width: number, height: number]

/** A rectangle starting at top-left coordinates `[x, y, width, height]` */
export type Rect =
  | [x: number, y: number, width: number, height: number]
  | Float64Array

/** A rectangle starting at top-left coordinates `[x, y, width, height]` that will not be modified */
export type ReadOnlyRect =
  | readonly [x: number, y: number, width: number, height: number]
  | ReadOnlyTypedArray<Float64Array>

export type ReadOnlyTypedArray<T extends Float64Array> = Omit<
  Readonly<T>,
  'fill' | 'copyWithin' | 'reverse' | 'set' | 'sort' | 'subarray'
>

/** A 2D vector as `[x, y]` */
export type Vector2 = [x: number, y: number]

/** A 4D vector as `[x, y, z, w]` */
export type Vector4 = [x: number, y: number, z: number, w: number]

/** Margin values as `[top, right, bottom, left]` */
export type Margin = [top: number, right: number, bottom: number, left: number]
