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
export function checkedWidgetDef(def: unknown): WidgetDef {
  const fields = definitionFields('add', def, FIELDS)
  const options = checkedOptions(fields.options)
  if (fields.type === 'combo' && !Array.isArray(options.values)) {
    throw invalidArgument('add', 'a combo with options.values', options.values)
  }
  return {
    type: requiredName('add', fields.type),
    name: requiredName('add', fields.name),
    value:
      fields.value === undefined
        ? undefined
        : savableValue('add', fields.value),
    options,
    serialize: optionalFlag('add', fields.serialize),
    disabled: optionalFlag('add', fields.disabled),
    hidden: optionalFlag('add', fields.hidden)
  }
}

function checkedOptions(options: unknown): WidgetOptions {
  if (options === undefined) return {}
  if (!isPlainObject(options)) {
    throw invalidArgument('add', 'options as a plain object', options)
  }
  assertSavable('add', options)
  return structuredClone(options)
}
