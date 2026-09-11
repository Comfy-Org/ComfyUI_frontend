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
    if (fields?.[name]) return { spec: fields[name], isOptional }
    for (const [key, spec] of Object.entries(fields ?? {})) {
      if (!name.startsWith(`${key}.`)) continue
      const suffix = name.slice(key.length + 1)
      const group = zDynamicGroupInputSpec.safeParse(spec).data
      if (group) {
        const separator = suffix.indexOf('.')
        const index = suffix.slice(0, separator)
        if (!/^(0|[1-9][0-9]*)$/.test(index) || Number(index) >= group[1].max)
          continue
        const field = suffix.slice(separator + 1)
        const template = group[1].template
        if (template.required?.[field])
          return { spec: template.required[field], isOptional: false }
        if (template.optional?.[field])
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
  }
}
