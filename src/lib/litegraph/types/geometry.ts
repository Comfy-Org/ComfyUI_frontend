/**
 * Pure geometry types for litegraph.
 * These have no dependencies on runtime code.
 */

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

/** A 2D vector */
export type Vector2 = [x: number, y: number]

/** A 4D vector */
export type Vector4 = [x: number, y: number, z: number, w: number]

/** Direction as cardinal points */
export type Direction = 'top' | 'bottom' | 'left' | 'right'

/** Resize handle positions (compass points) */
export type CompassCorners = 'NE' | 'SE' | 'SW' | 'NW'

/** A color value for canvas rendering */
export type CanvasColour = string | CanvasGradient | CanvasPattern
