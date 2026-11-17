import { isPlainObject } from 'es-toolkit'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
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
  const options = checkedOptions(member, fields.options)
  if (fields.type === 'combo' && !Array.isArray(options.values)) {
    throw invalidArgument(member, 'a combo with options.values', options.values)
  }
  return {
    type: requiredName(member, fields.type),
    name: requiredName(member, fields.name),
    value:
      fields.value === undefined
        ? undefined
        : savableValue(member, fields.value),
    options,
    serialize: optionalFlag(member, fields.serialize),
    disabled: optionalFlag(member, fields.disabled),
    hidden: optionalFlag(member, fields.hidden)
  }
}

function checkedOptions(member: string, options: unknown): WidgetOptions {
  if (options === undefined) return {}
  if (!isPlainObject(options)) {
    throw invalidArgument(member, 'options as a plain object', options)
  }
  assertSavable(member, options, 'options')
  return structuredClone(options)
}
