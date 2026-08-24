import { isEqual } from 'es-toolkit'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import {
  dynamicComboOptionTypes,
  inputSpecTree
} from '@/schemas/nodeDef/inputSpecTree'

/**
 * Select DynamicCombo options so that `node` exposes a socket of `wantedType`.
 *
 * Node search reports the union of every DynamicCombo option's input types, so
 * a node can be offered for a link type whose socket only exists under an
 * option the node was not created with.
 *
 * Only reports success once the socket actually exists. A combo option's types
 * include types reachable through a *nested* combo, which selecting the outer
 * option alone does not materialize, so the result is verified rather than
 * assumed; any selection made while failing is rolled back so a failed reveal
 * leaves the node exactly as it was.
 *
 * @returns whether the node now exposes `wantedType`
 */
export function revealDynamicInputSlot(
  node: LGraphNode,
  wantedType: string
): boolean {
  if (node.findInputByType(wantedType)) return false

  const defInputs = node.constructor.nodeData?.inputs
  if (!defInputs) return false

  // Each root input is attempted independently so a root that fails cannot
  // leave a combo selected on the way to a different root that succeeds.
  for (const rootSpec of Object.values(defInputs)) {
    if (revealWithin(node, rootSpec, wantedType)) return true
  }

  return false
}

function revealWithin(
  node: LGraphNode,
  rootSpec: InputSpecV2,
  wantedType: string
): boolean {
  const rollback: { widget: IBaseWidget; value: IBaseWidget['value'] }[] = []

  // Outermost first: selecting an outer option is what materializes the
  // widgets of any combo nested inside it.
  for (const spec of inputSpecTree(rootSpec)) {
    if (spec.type !== 'COMFY_DYNAMICCOMBO_V3') continue

    const options = dynamicComboOptionTypes(spec)
    const match = options.find(({ types }) => types.includes(wantedType))
    if (!match) continue

    // Prefer an exact name match; fall back to the option keys, because a
    // nested combo is named after its position in the tree and an autogrow
    // child carries an ordinal, neither of which the spec alone yields.
    const keys = options.map(({ key }) => key)
    const selectable = node.widgets?.filter(
      (candidate) => candidate.value !== match.key
    )
    const widget =
      selectable?.find((candidate) => candidate.name === spec.name) ??
      selectable?.find((candidate) => isEqual(candidate.options?.values, keys))
    if (!widget) continue

    rollback.push({ widget, value: widget.value })
    widget.value = match.key

    if (node.findInputByType(wantedType)) return true
  }

  for (const { widget, value } of rollback.reverse()) widget.value = value
  return false
}
