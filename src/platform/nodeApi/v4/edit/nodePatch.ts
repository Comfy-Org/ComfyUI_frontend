import type { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import type { NodeProperty } from '@comfyorg/graph-model/nodeProperty'
import { isEqual } from 'es-toolkit'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { isPlainData } from '@/platform/nodeApi/shared/savableValue'
import { checkedFields, isStoreKey } from '@/platform/nodeApi/v4/checkedFields'
import { MODE_NAMES } from '@/platform/nodeApi/v4/nodeHandle'
import { PACK_PROPERTIES } from '@/platform/nodeApi/v4/packs'
import type {
  NodeMode,
  NodeShape,
  Point,
  Size,
  SizeConstraints
} from '@/platform/nodeApi/v4/types'
import {
  checkedBoolean,
  checkedChoice,
  checkedNonNegative,
  checkedOptionalString,
  checkedPoint,
  checkedString,
  savableCopy
} from './checkedArguments'
import {
  checkedSizeConstraints,
  chooseResizable,
  fitToConstraints
} from './nodeSizing'

type NodeWrite = (node: LGraphNode) => boolean | void

const MODES = new Map<unknown, LGraphEventMode>(
  Object.entries(MODE_NAMES).map(([mode, name]) => [name, Number(mode)])
)

const SHAPES = {
  default: true,
  box: true,
  round: true,
  circle: true,
  card: true
} satisfies Record<NodeShape, true>

/** What `updateNode` changes. A field left out stays as it is. */
export interface NodePatch {
  readonly title?: string
  readonly mode?: NodeMode
  readonly collapsed?: boolean
  readonly color?: string | null
  readonly bgColor?: string | null
  readonly shape?: NodeShape
  readonly properties?: Readonly<Record<string, unknown>>
  readonly serializeWidgets?: boolean
  readonly position?: Point
  readonly size?: Size
  readonly sizeConstraints?: SizeConstraints
  readonly resizable?: boolean
}

/** A checked patch: its writes in a fixed order, and whether it turns widget saving off. */
export interface CheckedNodePatch {
  readonly writes: readonly NodeWrite[]
  readonly stopsSavingWidgets: boolean
}

/** Checks every field of `patch`, so nothing is applied unless the whole patch is usable. */
export function checkedNodePatch(
  patch: unknown,
  member: string
): CheckedNodePatch {
  const checks = fieldChecks(member)
  const given = checkedFields(member, 'a node patch', patch, FIELDS)
  return {
    writes: Object.entries(checks).flatMap(([field, check]) =>
      Object.hasOwn(given, field) ? [check(given[field])] : []
    ),
    stopsSavingWidgets: given.serializeWidgets === false
  }
}

const FIELDS = {
  title: true,
  mode: true,
  collapsed: true,
  color: true,
  bgColor: true,
  shape: true,
  properties: true,
  serializeWidgets: true,
  position: true,
  size: true,
  sizeConstraints: true,
  resizable: true
} satisfies Record<keyof NodePatch, true>

function fieldChecks(
  member: string
): Record<keyof NodePatch, (value: unknown) => NodeWrite> {
  return {
    title(value) {
      const title = checkedString(member, 'title', value)
      return (node) => {
        node.title = title
      }
    },
    mode(value) {
      const mode = MODES.get(value)
      if (mode === undefined) {
        throw invalidArgument(
          member,
          `mode of ${[...MODES.keys()].join(', ')}`,
          value
        )
      }
      return (node) => {
        node.mode = mode
      }
    },
    collapsed(value) {
      const collapsed = checkedBoolean(member, 'collapsed', value)
      return (node) => {
        if (node.collapsed !== collapsed) node.collapse(true)
      }
    },
    color(value) {
      const color = checkedOptionalString(member, 'color', value)
      return (node) => {
        node.color = color
      }
    },
    bgColor(value) {
      const color = checkedOptionalString(member, 'bgColor', value)
      return (node) => {
        node.bgcolor = color
      }
    },
    shape(value) {
      const shape = checkedChoice(member, 'shape', value, SHAPES)
      return (node) => {
        node.shape = shape
      }
    },
    properties: (value) => checkedProperties(member, value),
    serializeWidgets(value) {
      const serialize = checkedBoolean(member, 'serializeWidgets', value)
      return (node) => {
        node.serialize_widgets = serialize
      }
    },
    position(value) {
      const [x, y] = checkedPoint(member, 'position', value)
      return (node) => {
        node.pos = [x, y]
      }
    },
    size(value) {
      const { width, height } = checkedDimensions(member, value)
      return (node) => node.setSize([width, height])
    },
    sizeConstraints(value) {
      const constraints = checkedSizeConstraints(member, value)
      return (node) => fitToConstraints(node, constraints)
    },
    resizable(value) {
      const allowed = checkedBoolean(member, 'resizable', value)
      return (node) => chooseResizable(node, { resizable: allowed })
    }
  }
}

function checkedProperties(member: string, value: unknown): NodeWrite {
  if (!isPlainData(value)) {
    throw invalidArgument(member, 'properties as a plain object', value)
  }
  const entries = Object.entries(value).map(([name, property]) => {
    if (!isStoreKey(name)) {
      throw invalidArgument(member, 'a property name', name)
    }
    if (PACK_PROPERTIES.has(name)) {
      throw invalidArgument(
        member,
        'a property name other than cnr_id, aux_id and ver',
        name
      )
    }
    return [
      name,
      property === undefined
        ? undefined
        : savableCopy(member, `property ${name}`, property)
    ] as const
  })
  return (node) =>
    entries
      .map(([name, property]) =>
        property === undefined
          ? deleteProperty(node, name)
          : storeProperty(node, name, property)
      )
      .every(Boolean)
}

function storeProperty(
  node: LGraphNode,
  name: string,
  property: NodeProperty
): boolean {
  node.setProperty(name, property)
  return isEqual(node.properties[name], property)
}

function deleteProperty(node: LGraphNode, name: string): boolean {
  node.setProperty(name, undefined)
  if (node.properties[name] !== undefined) return false
  delete node.properties[name]
  return true
}

const SIZE_FIELDS = { width: true, height: true } as const

function checkedDimensions(
  member: string,
  value: unknown
): { width: number; height: number } {
  const size = checkedFields(member, 'size', value, SIZE_FIELDS)
  return {
    width: checkedNonNegative(member, 'size.width', size.width),
    height: checkedNonNegative(member, 'size.height', size.height)
  }
}
