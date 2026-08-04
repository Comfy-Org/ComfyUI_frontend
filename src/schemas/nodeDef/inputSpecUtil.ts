import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyInputsSpec } from '@/schemas/nodeDefSchema'

/**
 * Returns the node's top-level input specs plus any inputs nested inside
 * COMFY_DYNAMICCOMBO_V3 options, deduped by name (first occurrence wins).
 *
 * @param inputs The node's top-level input specs
 * @returns Flattened input specs including dynamic combo option inputs
 */
export function flattenInputSpecs(
  inputs: Record<string, InputSpecV2>
): InputSpecV2[] {
  const seenNames = new Set<string>()
  const result: InputSpecV2[] = []

  // First occurrence wins if two options declare the same input name.
  const addSpec = (spec: InputSpecV2) => {
    if (seenNames.has(spec.name)) return
    seenNames.add(spec.name)
    result.push(spec)
  }

  for (const spec of Object.values(inputs)) {
    addSpec(spec)
    if (spec.type !== 'COMFY_DYNAMICCOMBO_V3') continue

    const options = (
      spec as { options?: Array<{ key: string; inputs: ComfyInputsSpec }> }
    ).options
    if (!Array.isArray(options)) {
      if (import.meta.env.DEV) {
        console.warn(
          '[flattenInputSpecs] expected an options array on dynamic combo',
          spec.name
        )
      }
      continue
    }

    // Intentionally includes all options' inputs as a flat union -- the
    // Info tab is reference documentation, not live widget state tied to
    // the currently-selected option.
    for (const { inputs: nestedInputs } of options) {
      const buckets = [
        { inputs: nestedInputs.required, isOptional: false },
        { inputs: nestedInputs.optional, isOptional: true }
      ]
      for (const { inputs: nestedInputsOfKind, isOptional } of buckets) {
        for (const [name, nestedSpec] of Object.entries(
          nestedInputsOfKind ?? {}
        )) {
          addSpec(transformInputSpecV1ToV2(nestedSpec, { name, isOptional }))
        }
      }
    }
  }

  return result
}
