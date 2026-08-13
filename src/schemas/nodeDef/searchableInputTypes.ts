import { inputSpecTree, ownSlotTypes } from '@/schemas/nodeDef/inputSpecTree'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'

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
