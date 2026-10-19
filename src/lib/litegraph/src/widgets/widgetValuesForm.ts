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

interface WidgetSerializationFormReport {
  nodeId: string
  nodeType: string
}

export interface WidgetValuesFormPolicy {
  reportMissingDeclaration(report: WidgetSerializationFormReport): void
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

const reportedMissingWidgetForms = new WeakSet<object>()

function reportMissingWidgetForm(node: LGraphNode): void {
  if (reportedMissingWidgetForms.has(node)) return
  reportedMissingWidgetForms.add(node)
  policy?.reportMissingDeclaration({
    nodeId: String(node.id),
    nodeType: node.type
  })
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

function validateWidgetValuesForm(
  node: LGraphNode,
  serialised: ISerialisedNode,
  widgetOrderBeforeHook: readonly string[]
): boolean {
  const form = serialised.widgets_values_form
  if (form === undefined) return true

  const closedForm =
    isPlainRecord(form) &&
    Object.keys(form).length === 1 &&
    Array.isArray(form.order) &&
    form.order.length > 0 &&
    new Set(form.order).size === form.order.length &&
    form.order.every((name) => typeof name === 'string' && name.length > 0)
  assertWidgetValuesForm(
    closedForm,
    'Widget values form must be closed to a non-empty order',
    node
  )
  if (!closedForm) return false

  const currentOrder = serializableWidgetOrder(node.widgets ?? [])
  const values: unknown = serialised.widgets_values
  const hasSupportedValues = Array.isArray(values) || isPlainRecord(values)
  assertWidgetValuesForm(
    hasSupportedValues,
    'Widget values form must describe array- or object-shaped values',
    node
  )

  const arrayLengthAgrees =
    !Array.isArray(values) || form.order.length === values.length
  assertWidgetValuesForm(
    arrayLengthAgrees,
    'Widget values form length must match array-shaped values',
    node
  )

  const objectKeysAgree =
    !isPlainRecord(values) ||
    form.order.every((name) => Object.hasOwn(values, name))
  assertWidgetValuesForm(
    objectKeysAgree,
    'Widget values form order must be a unique subset of object-shaped values',
    node
  )

  const widgetOrderSurvived =
    isEqual(widgetOrderBeforeHook, currentOrder) &&
    isEqual(form.order, currentOrder)
  assertWidgetValuesForm(
    widgetOrderSurvived,
    'Widget values form order must survive serialization unchanged',
    node
  )

  return (
    hasSupportedValues &&
    arrayLengthAgrees &&
    objectKeysAgree &&
    widgetOrderSurvived
  )
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
    coreSerialization.order.length > 0 &&
    coreSerialization.order.every((name) => name.length > 0) &&
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

  if (serialised.widgets_values_form === undefined && isPlainRecord(values))
    reportMissingWidgetForm(node)
}
