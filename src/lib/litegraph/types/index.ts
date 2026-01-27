/**
 * Type-only barrel export for litegraph types.
 *
 * This module exports pure type definitions that can be imported
 * without pulling in any runtime code, helping to avoid circular
 * dependency issues.
 *
 * @example
 * ```typescript
 * import type { Point, NodeId, INodeSlot } from '@/lib/litegraph/types'
 * ```
 */

// Geometry types
export type {
  CanvasColour,
  CompassCorners,
  Direction,
  Point,
  ReadOnlyRect,
  ReadOnlyTypedArray,
  Rect,
  Size,
  Vector2,
  Vector4
} from './geometry'

// ID types
export type { LinkId, NodeId, RerouteId } from './ids'

// Slot types
export type {
  HasBoundingRect,
  INodeFlags,
  INodeInputSlotBase,
  INodeOutputSlotBase,
  INodeSlotBase,
  ISlotType,
  IWidgetInputSlotBase,
  IWidgetLocator
} from './slots'

// Utility types
export type {
  Dictionary,
  MethodNames,
  NeverNever,
  NullableProperties,
  OptionalProps,
  PickNevers,
  RequiredProps,
  SharedIntersection,
  WhenNullish
} from './utility'
