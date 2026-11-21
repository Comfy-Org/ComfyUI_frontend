import {
  getComboSpecComboOptions,
  getInputSpecType,
  isComboInputSpec
} from '@comfyorg/object-info-parser'
import { isPlainObject } from 'es-toolkit'
import type {
  ComfyNodeDef as ComfyNodeDefV1,
  InputSpec
} from '@comfyorg/object-info-parser'

import { resolveNodeDefSlotText, resolveNodeDefText } from '@/i18n'
import type { SavedCopier } from '@/platform/nodeApi/shared/savedCopy'
import type {
  NodeDef,
  NodeDefInput,
  NodeDefOutput
} from '@/platform/nodeApi/v4/types'

const NO_OPTIONS: Readonly<Record<string, unknown>> = Object.freeze({})

/** The pack's view of a definition the host registers. A part the server sent malformed reads as empty. */
export function nodeDefFromHost(
  hostDef: ComfyNodeDefV1,
  copyOfSaved: SavedCopier
): NodeDef {
  const type = hostDef.name
  const input = recordOf(hostDef.input)
  const declaredInputs = Object.entries({
    ...recordOf(input.required),
    ...recordOf(input.optional)
  }).filter((entry): entry is [string, InputSpec] => isInputSpec(entry[1]))
  const outputNames = listOf(hostDef.output_name)
  return Object.freeze({
    type,
    title:
      resolveNodeDefText('display_name', type, textOf(hostDef.display_name)) ||
      type,
    category: textOf(hostDef.category) ?? '',
    description: resolveNodeDefText(
      'description',
      type,
      textOf(hostDef.description)
    ),
    inputs: Object.freeze(
      declaredInputs.map(([name, spec]) =>
        hostInput(type, name, spec, copyOfSaved)
      )
    ),
    outputs: Object.freeze(
      listOf(hostDef.output).flatMap((output, index) =>
        hostOutput(output, outputNames[index])
      )
    ),
    hidden: copyOfSaved('def.hidden', recordOf(input.hidden)) ?? NO_OPTIONS,
    isOutputNode: isTrue(hostDef.output_node)
  })
}

/** The category a definition the host registers declares, or none if it is malformed. */
export function categoryOfHostDef(hostDef: ComfyNodeDefV1): string {
  return textOf(hostDef.category) ?? ''
}

function hostInput(
  type: string,
  name: string,
  spec: InputSpec,
  copyOfSaved: SavedCopier
): NodeDefInput {
  const options = recordOf(spec[1])
  const values = isComboInputSpec(spec)
    ? {
        values: Object.freeze(
          listOf(getComboSpecComboOptions(spec)).filter(isChoice)
        )
      }
    : {}
  return Object.freeze({
    name,
    type: getInputSpecType(spec),
    localizedName: resolveNodeDefSlotText(
      'name',
      type,
      name,
      textOf(options.display_name),
      name
    ),
    ...values,
    options: copyOfSaved('def.inputs.options', options) ?? NO_OPTIONS
  })
}

function hostOutput(output: unknown, name: unknown): NodeDefOutput[] {
  const type =
    typeof output === 'string'
      ? output
      : Array.isArray(output)
        ? 'COMBO'
        : undefined
  if (type === undefined) return []
  return [Object.freeze({ name: textOf(name) ?? type, type })]
}

function isInputSpec(spec: unknown): spec is InputSpec {
  return (
    Array.isArray(spec) &&
    (typeof spec[0] === 'string' || Array.isArray(spec[0])) &&
    (spec[1] === undefined || isPlainObject(spec[1]))
  )
}

function isTrue(value: unknown): boolean {
  return value === true
}

function isChoice(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number'
}

function recordOf(value: unknown): Readonly<Record<string, unknown>> {
  return isPlainObject(value) ? value : NO_OPTIONS
}

function listOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : []
}

function textOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}
