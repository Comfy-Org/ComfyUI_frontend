import { isPlainObject, omit } from 'es-toolkit'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import {
  callIsolated,
  reportListenerFailure
} from '@/platform/nodeApi/shared/listeners'
import type { WidgetDef, WidgetOptions } from '@/platform/nodeApi/v4/types'
import {
  definitionFields,
  optionalFlag,
  requiredName
} from './definitionFields'
import { assertSavable, savableValue } from './savableValue'

const FIELDS = [
  'type',
  'name',
  'value',
  'options',
  'serialize',
  'disabled',
  'hidden'
] as const satisfies readonly (keyof WidgetDef)[]

/** A copy of a widget definition from a pack, or a `TypeError` for what it got wrong. */
export function checkedWidgetDef(def: unknown, member = 'add'): WidgetDef {
  const fields = definitionFields(member, def, FIELDS)
  const type = requiredName(member, fields.type)
  return {
    type,
    name: widgetName(member, fields.name),
    value:
      fields.value === undefined
        ? undefined
        : savableValue(member, fields.value),
    options: checkedOptions(member, type, fields.options),
    serialize: optionalFlag(member, fields.serialize),
    disabled: optionalFlag(member, fields.disabled),
    hidden: optionalFlag(member, fields.hidden)
  }
}

function widgetName(member: string, name: unknown): string {
  if (typeof name !== 'string') {
    throw invalidArgument(member, 'a widget name as text', name)
  }
  return name
}

function checkedOptions(
  member: string,
  type: string,
  options: unknown
): WidgetOptions {
  if (options === undefined) return listedValues(member, type, {})
  if (!isPlainObject(options)) {
    throw invalidArgument(member, 'options as a plain object', options)
  }
  const values: unknown = Object.getOwnPropertyDescriptor(
    options,
    'values'
  )?.value
  if (type === 'combo' && typeof values === 'function') {
    const others = omit(Object.getOwnPropertyDescriptors(options), ['values'])
    return {
      ...savableOptions(member, Object.defineProperties({}, others)),
      values: comboValues((): unknown => Reflect.apply(values, undefined, []))
    }
  }
  return listedValues(member, type, savableOptions(member, options))
}

function savableOptions<T extends object>(member: string, options: T): T {
  assertSavable(member, options, 'options')
  return structuredClone(options)
}

function listedValues(
  member: string,
  type: string,
  options: WidgetOptions
): WidgetOptions {
  if (type === 'combo' && !Array.isArray(options.values)) {
    throw invalidArgument(
      member,
      'options.values as a list or a function',
      options.values
    )
  }
  return options
}

function comboValues(
  values: () => unknown
): () => readonly (string | number)[] {
  return () => {
    const listed = callIsolated('options.values', values)
    if (!listed.ok) return []
    if (Array.isArray(listed.value) && listed.value.every(isComboValue)) {
      return Array.from(listed.value)
    }
    reportListenerFailure(
      'options.values',
      invalidArgument(
        'options.values',
        'a list of text or finite numbers',
        listed.value
      )
    )
    return []
  }
}

function isComboValue(value: unknown): value is string | number {
  return typeof value === 'string' || Number.isFinite(value)
}
