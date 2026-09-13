import {
  zDynamicComboInputSpec,
  zDynamicGroupInputSpec
} from '@/schemas/nodeDefSchema'
import type { ComfyInputsSpec, InputSpec } from '@/schemas/nodeDefSchema'
import type { WidgetValue } from '@/types/simplifiedWidget'

export function resolveDynamicInputSpec(
  inputs: ComfyInputsSpec,
  name: string,
  getValue: (name: string) => WidgetValue,
  prefix = ''
): { spec: InputSpec; isOptional: boolean } | undefined {
  for (const [fields, isOptional] of [
    [inputs.required, false],
    [inputs.optional, true]
  ] as const) {
    if (fields && Object.hasOwn(fields, name))
      return { spec: fields[name], isOptional }
    for (const [key, spec] of Object.entries(fields ?? {})) {
      if (!name.startsWith(`${key}.`)) continue
      const resolved = resolveNestedInputSpec(spec, key, name, getValue, prefix)
      if (resolved) return resolved
    }
  }
}

function resolveNestedInputSpec(
  spec: InputSpec,
  key: string,
  name: string,
  getValue: (name: string) => WidgetValue,
  prefix: string
): { spec: InputSpec; isOptional: boolean } | undefined {
  const suffix = name.slice(key.length + 1)
  const group = zDynamicGroupInputSpec.safeParse(spec).data
  if (group) {
    const separator = suffix.indexOf('.')
    if (separator === -1) return
    const index = suffix.slice(0, separator)
    if (!/^(0|[1-9][0-9]*)$/.test(index)) return
    const field = suffix.slice(separator + 1)
    const template = group[1].template
    if (template.required && Object.hasOwn(template.required, field))
      return { spec: template.required[field], isOptional: false }
    if (template.optional && Object.hasOwn(template.optional, field))
      return { spec: template.optional[field], isOptional: true }
  }
  const combo = zDynamicComboInputSpec.safeParse(spec).data
  const selected = combo?.[1].options.find(
    ({ key: option }) => option === getValue(`${prefix}${key}`)
  )
  if (selected)
    return resolveDynamicInputSpec(
      selected.inputs,
      suffix,
      getValue,
      `${prefix}${key}.`
    )
}
