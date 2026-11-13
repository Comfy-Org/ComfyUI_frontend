import {
  getComboSpecComboOptions,
  getInputSpecType,
  isComboInputSpec
} from '@comfyorg/object-info-parser'
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

/** The pack's view of a definition the host registers, built from the host's own record of it. */
export function nodeDefFromHost(
  hostDef: ComfyNodeDefV1,
  copyOfSaved: SavedCopier
): NodeDef {
  const { name: type, input = {} } = hostDef
  const declaredInputs = Object.entries({
    ...input.required,
    ...input.optional
  })
  return Object.freeze({
    type,
    title:
      resolveNodeDefText('display_name', type, hostDef.display_name) || type,
    category: hostDef.category,
    description: resolveNodeDefText('description', type, hostDef.description),
    inputs: Object.freeze(
      declaredInputs.map(([name, spec]) =>
        hostInput(type, name, spec, copyOfSaved)
      )
    ),
    outputs: Object.freeze((hostDef.output ?? []).map(hostOutput(hostDef))),
    hidden: copyOfSaved('def.hidden', input.hidden ?? {}) ?? NO_OPTIONS,
    isOutputNode: hostDef.output_node
  })
}

function hostInput(
  type: string,
  name: string,
  spec: InputSpec,
  copyOfSaved: SavedCopier
): NodeDefInput {
  const options = spec[1] ?? {}
  const shownName =
    typeof options.display_name === 'string' ? options.display_name : undefined
  const values = isComboInputSpec(spec)
    ? { values: Object.freeze([...getComboSpecComboOptions(spec)]) }
    : {}
  return Object.freeze({
    name,
    type: getInputSpecType(spec),
    localizedName: resolveNodeDefSlotText('name', type, name, shownName, name),
    ...values,
    options: copyOfSaved('def.inputs.options', options) ?? NO_OPTIONS
  })
}

function hostOutput(hostDef: ComfyNodeDefV1) {
  return (
    output: string | readonly unknown[],
    index: number
  ): NodeDefOutput => {
    const type = typeof output === 'string' ? output : 'COMBO'
    return Object.freeze({ name: hostDef.output_name?.[index] ?? type, type })
  }
}
