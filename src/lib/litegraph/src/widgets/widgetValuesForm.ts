import { isEqual } from 'es-toolkit'

import { assert } from '@/base/assert'
import type { LGraphNode } from '@/lib/litegraph/src/types/entityRegistry'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type {
  IBaseWidget,
  TWidgetValue
} from '@/lib/litegraph/src/types/widgets'

export interface CoreWidgetSerialization {
  order: string[]
  widgets_values: TWidgetValue[]
  widgets_values_named: Record<string, TWidgetValue>
}

export interface WidgetValuesFormPolicy {
  widgetLayoutDependsOnValues(node: LGraphNode): boolean
}

let policy: WidgetValuesFormPolicy | undefined

export function setWidgetValuesFormPolicy(
  next: WidgetValuesFormPolicy | undefined
): void {
  policy = next
}

export function serializableWidgetOrder(
  widgets: readonly IBaseWidget[]
): string[] {
  return widgets
    .filter((widget) => widget.serialize !== false)
    .map((widget) => widget.name)
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function assertWidgetValuesForm(
  condition: boolean,
  message: string,
  node: LGraphNode
): boolean {
  assert(condition, message, {
    nodeId: String(node.id),
    nodeType: node.type
  })
  return condition
}

function isClosedForm(form: unknown): form is { order: string[] } {
  return (
    isPlainRecord(form) &&
    Object.keys(form).length === 1 &&
    Array.isArray(form.order) &&
    form.order.length > 0 &&
    new Set(form.order).size === form.order.length &&
    form.order.every((name) => typeof name === 'string' && name.length > 0)
  )
}

function validateWidgetValuesForm(
  node: LGraphNode,
  serialised: ISerialisedNode,
  widgetOrderBeforeHook: readonly string[]
): boolean {
  const form: unknown = serialised.widgets_values_form
  if (form === undefined) return true
  const closed = isClosedForm(form)
  assertWidgetValuesForm(
    closed,
    'Widget values form must be closed to a non-empty order',
    node
  )
  if (!closed) return false

  const { order } = form
  const values: unknown = serialised.widgets_values
  const currentOrder = serializableWidgetOrder(node.widgets ?? [])
  const checks: [boolean, string][] = [
    [
      Array.isArray(values) || isPlainRecord(values),
      'Widget values form must describe array- or object-shaped values'
    ],
    [
      !Array.isArray(values) || order.length === values.length,
      'Widget values form length must match array-shaped values'
    ],
    [
      !isPlainRecord(values) ||
        order.every((name) => Object.hasOwn(values, name)),
      'Widget values form order must name keys in object-shaped values'
    ],
    [
      isEqual(widgetOrderBeforeHook, currentOrder) &&
        isEqual(order, currentOrder),
      'Widget values form order must survive serialization unchanged'
    ]
  ]
  return checks
    .map(([condition, message]) =>
      assertWidgetValuesForm(condition, message, node)
    )
    .every(Boolean)
}

export function finalizeWidgetValuesForm(
  node: LGraphNode,
  serialised: ISerialisedNode,
  widgetOrderBeforeHook: readonly string[],
  coreSerialization?: CoreWidgetSerialization
): void {
  const values: unknown = serialised.widgets_values
  if (
    serialised.widgets_values_form === undefined &&
    coreSerialization &&
    isClosedForm({ order: coreSerialization.order }) &&
    Array.isArray(values) &&
    isEqual(values, coreSerialization.widgets_values) &&
    isEqual(
      widgetOrderBeforeHook,
      serializableWidgetOrder(node.widgets ?? [])
    ) &&
    !policy?.widgetLayoutDependsOnValues(node)
  ) {
    serialised.widgets_values_form = { order: [...coreSerialization.order] }
  }

  if (!validateWidgetValuesForm(node, serialised, widgetOrderBeforeHook))
    delete serialised.widgets_values_form
}
