import { inputSpecTree } from '@/schemas/nodeDef/inputSpecTree'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'

/**
 * Returns the node's top-level input specs plus every input nested inside a
 * dynamic control, deduped by name (first occurrence wins).
 *
 * Intentionally includes all DynamicCombo options' inputs as a flat union --
 * the Info tab is reference documentation, not live widget state tied to the
 * currently-selected option.
 *
 * @param inputs The node's top-level input specs
 * @returns Flattened input specs including nested dynamic control inputs
 */
export function flattenInputSpecs(
  inputs: Record<string, InputSpecV2>
): InputSpecV2[] {
  const seenNames = new Set<string>()
  const result: InputSpecV2[] = []

  for (const spec of Object.values(inputs)) {
    for (const nested of inputSpecTree(spec)) {
      if (seenNames.has(nested.name)) continue
      seenNames.add(nested.name)
      result.push(nested)
    }
  }

  return result
}
