import type { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import { isPlainObject } from 'es-toolkit'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { MODE_NAMES } from '@/platform/nodeApi/v4/nodeHandle'
import type { NodePatch, NodeShape } from '@/platform/nodeApi/v4/types'
import {
  assertPatch,
  checkedBoolean,
  checkedChoice,
  checkedNonNegative,
  checkedOptionalString,
  checkedPoint,
  fieldsOf,
  checkedString,
  savableCopy
} from './checkedArguments'
import { checkedSizeConstraints, fitToConstraints } from './nodeSizing'
import type { ResizableChoices } from './nodeSizing'

/** One validated change to a node, ready to apply. */
type NodeWrite = (node: LGraphNode) => void

const MEMBER = 'updateNode'

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

/** A checked patch: its writes in a fixed order, and whether it turns widget saving off. */
export interface CheckedNodePatch {
  readonly writes: readonly NodeWrite[]
  readonly stopsSavingWidgets: boolean
}

/** Checks every field of `patch`, so nothing is applied unless the whole patch is usable. */
export function checkedNodePatch(
  patch: unknown,
  resizable: ResizableChoices
): CheckedNodePatch {
  const checks = fieldChecks(resizable)
  assertPatch(MEMBER, patch, FIELDS)
  return {
    writes: Object.entries(checks).flatMap(([field, check]) =>
      Object.hasOwn(patch, field) ? [check(patch[field])] : []
    ),
    stopsSavingWidgets: patch.serializeWidgets === false
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
  resizable: ResizableChoices
): Record<keyof NodePatch, (value: unknown) => NodeWrite> {
  return {
    title(value) {
      const title = checkedString(MEMBER, 'title', value)
      return (node) => {
        node.title = title
      }
    },
    mode(value) {
      const mode = MODES.get(value)
      if (mode === undefined) {
        throw invalidArgument(
          MEMBER,
          `mode of ${[...MODES.keys()].join(', ')}`,
          value
        )
      }
      return (node) => {
        node.mode = mode
      }
    },
    collapsed(value) {
      const collapsed = checkedBoolean(MEMBER, 'collapsed', value)
      return (node) => {
        if (node.collapsed !== collapsed) node.collapse(true)
      }
    },
    color(value) {
      const color = checkedOptionalString(MEMBER, 'color', value)
      return (node) => {
        node.color = color
      }
    },
    bgColor(value) {
      const color = checkedOptionalString(MEMBER, 'bgColor', value)
      return (node) => {
        node.bgcolor = color
      }
    },
    shape(value) {
      const shape = checkedChoice(MEMBER, 'shape', value, SHAPES)
      return (node) => {
        node.shape = shape
      }
    },
    properties: checkedProperties,
    serializeWidgets(value) {
      const serialize = checkedBoolean(MEMBER, 'serializeWidgets', value)
      return (node) => {
        node.serialize_widgets = serialize
      }
    },
    position(value) {
      const [x, y] = checkedPoint(MEMBER, 'position', value)
      return (node) => {
        node.pos = [x, y]
      }
    },
    size(value) {
      const { width, height } = checkedDimensions(value)
      return (node) => node.setSize([width, height])
    },
    sizeConstraints(value) {
      const constraints = checkedSizeConstraints(MEMBER, value)
      return (node) => fitToConstraints(node, constraints)
    },
    resizable(value) {
      const allowed = checkedBoolean(MEMBER, 'resizable', value)
      return (node) => resizable.choose(node, allowed)
    }
  }
}

function checkedProperties(value: unknown): NodeWrite {
  if (!isPlainObject(value)) {
    throw invalidArgument(MEMBER, 'properties as a plain object', value)
  }
  const entries = Object.entries(value).map(([name, property]) => {
    if (name === '__proto__') {
      throw invalidArgument(MEMBER, 'a property name', name)
    }
    return [name, savableCopy(MEMBER, `property ${name}`, property)] as const
  })
  return (node) => {
    for (const [name, property] of entries) node.setProperty(name, property)
  }
}

function checkedDimensions(value: unknown): { width: number; height: number } {
  const size = fieldsOf(MEMBER, 'size', value)
  return {
    width: checkedNonNegative(MEMBER, 'size.width', size.width),
    height: checkedNonNegative(MEMBER, 'size.height', size.height)
  }
}
