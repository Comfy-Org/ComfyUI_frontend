import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { dynamicComboOptionTypes } from '@/schemas/nodeDef/inputSpecTree'

/**
 * Select the DynamicCombo option that exposes `wantedType`, if the node does
 * not already have a socket for it.
 *
 * Node search reports the union of every DynamicCombo option's input types, so
 * a node can be offered for a link type whose socket only exists under an
 * option the node was not created with. Setting the combo materializes that
 * option's inputs before the caller attempts the connection.
 *
 * @returns whether an option was selected
 */
export function revealDynamicInputSlot(
  node: LGraphNode,
  wantedType: string
): boolean {
  if (node.findInputByType(wantedType)) return false

  const inputs = node.constructor.nodeData?.inputs
  if (!inputs) return false

  for (const spec of Object.values(inputs)) {
    const match = dynamicComboOptionTypes(spec).find(({ types }) =>
      types.includes(wantedType)
    )
    if (!match) continue

    const widget = node.widgets?.find((w) => w.name === spec.name)
    if (!widget || widget.value === match.key) continue

    widget.value = match.key
    return true
  }

  return false
}
