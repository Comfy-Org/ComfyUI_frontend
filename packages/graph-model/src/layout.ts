import type {
  Bounds,
  Point2D as Point,
  Size2D as Size
} from '@comfyorg/shared-frontend-utils/geometry'
import type { NodeId } from './nodeId'
import type { GroupId } from './groupId'
import type { RerouteId } from './rerouteId'
import type { SlotDirection, SlotIndex } from './slotId'

export interface NodeBoundsUpdate {
  nodeId: NodeId
  bounds: Bounds
}

export interface NodeLayout {
  id: NodeId
  position: Point
  size: Size
  zIndex: number
  visible: boolean

  bounds: Bounds
}

export interface SlotLayout {
  nodeId: NodeId
  index: SlotIndex
  type: SlotDirection
  position: Point
  bounds: Bounds
}

export interface SlotOffset {
  index: SlotIndex
  type: SlotDirection
  position: Point
}

export type SlotOffsetMode = 'expanded' | 'collapsed'

export interface GroupLayout {
  id: GroupId
  position: Point
  size: Size
}

export interface RerouteLayout {
  id: RerouteId
  position: Point
  radius: number
  bounds: Bounds
}
