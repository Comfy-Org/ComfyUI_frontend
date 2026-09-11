import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyInputsSpec } from '@/schemas/nodeDefSchema'
import {
  zDynamicComboInputSpec,
  zDynamicGroupInputSpec
} from '@/schemas/nodeDefSchema'
import { useNodeDefStore } from '@/stores/nodeDefStore'

export function restoreDynamicGroupInputs(
  node: LGraphNode,
  inputs: ComfyApiWorkflow[string]['inputs']
) {
  const definition = useNodeDefStore().fromLGraphNode(node)
  const names = new Map<string, string>()

  function restore(specs: ComfyInputsSpec, prefix = '') {
    for (const [key, spec] of Object.entries({
      ...specs.required,
      ...specs.optional
    })) {
      const name = `${prefix}${key}`
      const controller = node.widgets?.find((widget) => widget.name === name)
      if (!controller) continue
      const combo = zDynamicComboInputSpec.safeParse(spec).data
      if (combo) {
        const selected = combo[1].options.find(
          (option) => option.key === inputs[name]
        )
        if (selected) {
          controller.value = selected.key
          restore(selected.inputs, `${name}.`)
        }
        continue
      }
      const group = zDynamicGroupInputSpec.safeParse(spec).data
      if (!group) continue
      const fields = {
        ...group[1].template.required,
        ...group[1].template.optional
      }
      const rows = new Map<string, number>()
      for (const input of Object.keys(inputs)) {
        if (!input.startsWith(`${name}.`)) continue
        const suffix = input.slice(name.length + 1)
        const separator = suffix.indexOf('.')
        const index = suffix.slice(0, separator)
        const field = suffix.slice(separator + 1)
        if (!/^(0|[1-9][0-9]*)$/.test(index) || !Object.hasOwn(fields, field))
          continue
        if (!rows.has(index)) rows.set(index, rows.size)
        names.set(input, `${name}.${rows.get(index)}.${field}`)
      }
      controller.value = rows.size
    }
  }

  if (definition) restore(definition.input)
  return Object.fromEntries(
    Object.entries(inputs).map(([name, value]) => [
      names.get(name) ?? name,
      value
    ])
  )
}
