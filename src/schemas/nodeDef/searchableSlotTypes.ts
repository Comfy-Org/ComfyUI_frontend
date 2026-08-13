import {
  inputSpecTree,
  matchTypeTemplate,
  ownSlotTypes,
  splitSlotTypes
} from '@/schemas/nodeDef/inputSpecTree'
import type {
  InputSpec as InputSpecV2,
  OutputSpec as OutputSpecV2
} from '@/schemas/nodeDef/nodeDefSchemaV2'

/**
 * Every slot type an input could expose, including types nested inside
 * dynamic controls.
 *
 * The result is a union of possibilities across DynamicCombo options, which
 * are mutually exclusive at runtime -- a node instance exposes the sockets of
 * one selected option, not all of them. Use this for search and discovery
 * only; to ask what a live node accepts, inspect `node.inputs`.
 */
export function collectSearchableInputTypes(input: InputSpecV2): string[] {
  return inputSpecTree(input).flatMap(ownSlotTypes)
}

/**
 * Every slot type an output could produce.
 *
 * A MatchType output has no concrete type of its own: it resolves at runtime
 * to whatever its template group's connected inputs agree on. Its allowed
 * types stand in for that, so the node is findable by what it can produce
 * rather than by the literal COMFY_MATCHTYPE_V3 placeholder.
 */
export function collectSearchableOutputTypes(
  outputs: OutputSpecV2[],
  inputs: Record<string, InputSpecV2>,
  outputMatchTypes: (string | undefined)[] | undefined
): string[] {
  const allowedTypesByTemplate = new Map<string, string[]>()
  for (const input of Object.values(inputs)) {
    for (const spec of inputSpecTree(input)) {
      const template = matchTypeTemplate(spec)
      if (template) {
        allowedTypesByTemplate.set(template.templateId, template.allowedTypes)
      }
    }
  }

  return outputs.flatMap((output) => {
    if (output.type !== 'COMFY_MATCHTYPE_V3') return splitSlotTypes(output.type)

    const templateId = outputMatchTypes?.[output.index]
    return templateId ? (allowedTypesByTemplate.get(templateId) ?? []) : []
  })
}
