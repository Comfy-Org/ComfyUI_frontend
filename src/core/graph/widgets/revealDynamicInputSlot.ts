import { isEqual } from 'es-toolkit'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
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

  const rollback: { widget: IBaseWidget; value: IBaseWidget['value'] }[] = []

  // Outermost first: selecting an outer option is what materializes the
  // widgets of any combo nested inside it.
  for (const spec of Object.values(defInputs).flatMap(inputSpecTree)) {
    if (spec.type !== 'COMFY_DYNAMICCOMBO_V3') continue

    const options = dynamicComboOptionTypes(spec)
    const match = options.find(({ types }) => types.includes(wantedType))
    if (!match) continue

    // Match the widget by its option keys rather than by name: nested combos
    // are named after their position in the tree, and autogrow prefixes an
    // ordinal, neither of which is derivable from the spec alone.
    const keys = options.map(({ key }) => key)
    const widget = node.widgets?.find(
      (candidate) =>
        isEqual(candidate.options?.values, keys) &&
        candidate.value !== match.key
    )
    if (!widget) continue

    rollback.push({ widget, value: widget.value })
    widget.value = match.key

    if (node.findInputByType(wantedType)) return true
  }

  for (const { widget, value } of rollback.reverse()) widget.value = value
  return false
}
