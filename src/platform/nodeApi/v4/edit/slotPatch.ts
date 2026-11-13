import type { RenderShape } from '@comfyorg/graph-model/globalEnums'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type {
  InputSlotPatch,
  SlotOptions,
  SlotPatch,
  SlotSide
} from '@/platform/nodeApi/v4/types'
import {
  assertPatch,
  checkedChoice,
  checkedPoint,
  checkedString
} from './checkedArguments'
import type { LiveSlot } from './liveSlot'
import { SLOT_DIRECTIONS, SLOT_SHAPES } from './slotVocabulary'

/** One validated change to a slot, ready to apply. */
type SlotWrite = (live: LiveSlot) => void

const PATCH_FIELDS = {
  name: true,
  label: true,
  localizedName: true,
  type: true,
  color: true,
  colorWhenUnconnected: true,
  shape: true,
  position: true,
  direction: true,
  widget: true
} satisfies Record<keyof InputSlotPatch, true>

const { widget: _inputOnly, ...OUTPUT_PATCH_FIELDS } = PATCH_FIELDS

/** A checked patch: its writes, the name it needs free, and the widget an input becomes the socket of. */
export interface CheckedSlotPatch {
  readonly fields: readonly string[]
  readonly writes: readonly SlotWrite[]
  readonly name: string | undefined
  readonly widget: string | undefined
}

export function checkedSlotPatch(
  patch: unknown,
  side: SlotSide
): CheckedSlotPatch {
  const member = 'updateSlot'
  assertPatch(
    member,
    patch,
    side === 'input' ? PATCH_FIELDS : OUTPUT_PATCH_FIELDS
  )
  const checks = fieldChecks(member)
  const writes = Object.entries(checks).flatMap(([field, check]) =>
    Object.hasOwn(patch, field) ? [check(patch[field])] : []
  )
  const { name, widget } = patch
  return {
    fields: Object.keys(patch),
    writes,
    name: name === undefined ? undefined : checkedSlotName(member, name),
    widget:
      widget === undefined ? undefined : checkedString(member, 'widget', widget)
  }
}

/** A slot's name: text that is not empty. */
export function checkedSlotName(member: string, value: unknown): string {
  const name = checkedString(member, 'name', value)
  if (name === '')
    throw invalidArgument(member, 'a name that is not empty', value)
  return name
}

/** A slot type: a name, or several, which the host keeps joined by commas. */
export function checkedSlotType(member: string, value: unknown): string {
  const names = Array.isArray(value) ? value : [value]
  if (names.length === 0) throw invalidArgument(member, 'a type', value)
  return names
    .map((name) => {
      const type = checkedString(member, 'type', name)
      if (type === '') throw invalidArgument(member, 'a type name', name)
      return type
    })
    .join(',')
}

const OPTION_FIELDS = {
  shape: true,
  widget: true
} satisfies Record<keyof SlotOptions, true>

/** The slot fields `addInput` and `addOutput` pass to the host for the options. */
export function checkedSlotOptions(
  member: string,
  options: unknown,
  side: SlotSide
): { readonly shape?: RenderShape; readonly widget?: { name: string } } {
  if (options === undefined) return {}
  const { widget: _inputOnly, ...outputFields } = OPTION_FIELDS
  assertPatch(member, options, side === 'input' ? OPTION_FIELDS : outputFields)
  const { shape, widget } = options
  return {
    ...(shape === undefined
      ? {}
      : {
          shape: SLOT_SHAPES[checkedChoice(member, 'shape', shape, SLOT_SHAPES)]
        }),
    ...(widget === undefined
      ? {}
      : { widget: { name: checkedString(member, 'widget', widget) } })
  }
}

/**
 * Refuses a name another slot on the same side has (A-03 keeps names unique
 * so slots stay addressable by name), and a widget the node does not have.
 */
export function assertFitsNode(
  member: string,
  node: LGraphNode,
  side: SlotSide,
  { name, widget, except }: { name?: string; widget?: string; except?: object }
): void {
  const siblings: readonly { name: string }[] =
    side === 'input' ? node.inputs : node.outputs
  if (
    name !== undefined &&
    siblings.some((slot) => slot !== except && slot.name === name)
  ) {
    throw invalidArgument(member, 'a name no other slot on this side has', name)
  }
  if (
    widget !== undefined &&
    !node.widgets?.some((candidate) => candidate.name === widget)
  ) {
    throw invalidArgument(member, 'the name of a widget on the node', widget)
  }
}

function clearable<T>(check: (value: unknown) => T) {
  return (value: unknown): T | undefined =>
    value === undefined || value === null ? undefined : check(value)
}

function fieldChecks(
  member: string
): Record<keyof SlotPatch, (value: unknown) => SlotWrite> {
  const text = (field: string) =>
    clearable((value) => checkedString(member, field, value))
  return {
    name(value) {
      const name = checkedSlotName(member, value)
      return ({ slot }) => {
        slot.name = name
      }
    },
    label(value) {
      const label = text('label')(value)
      return ({ slot }) => {
        slot.label = label
      }
    },
    localizedName(value) {
      const localized = text('localizedName')(value)
      return ({ slot }) => {
        slot.localized_name = localized
      }
    },
    type(value) {
      const type = checkedSlotType(member, value)
      return (live) => {
        if (live.side === 'output')
          live.node.setOutputDataType(live.index, type)
        else live.slot.type = type
      }
    },
    color(value) {
      const color = text('color')(value)
      return ({ slot }) => {
        slot.color_on = color
      }
    },
    colorWhenUnconnected(value) {
      const color = text('colorWhenUnconnected')(value)
      return ({ slot }) => {
        slot.color_off = color
      }
    },
    shape(value) {
      const shape =
        SLOT_SHAPES[checkedChoice(member, 'shape', value, SLOT_SHAPES)]
      return ({ slot }) => {
        slot.shape = shape
      }
    },
    position(value) {
      const position = clearable((given) =>
        checkedPoint(member, 'position', given)
      )(value)
      return ({ slot }) => {
        slot.pos = position
      }
    },
    direction(value) {
      const direction = clearable(
        (given) =>
          SLOT_DIRECTIONS[
            checkedChoice(member, 'direction', given, SLOT_DIRECTIONS)
          ]
      )(value)
      return ({ slot }) => {
        slot.dir = direction
      }
    }
  }
}
