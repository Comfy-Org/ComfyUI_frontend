import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { inputSpecTree, ownSlotTypes } from '@/schemas/nodeDef/inputSpecTree'
import { transformNodeDefV1ToV2 } from '@/schemas/nodeDef/migration'
import { collectSearchableOutputTypes } from '@/schemas/nodeDef/searchableSlotTypes'

import { ComfyWidgets } from '../../scripts/widgets'

/**
 * The socket types a node def should be registered under for link-release
 * suggestions.
 *
 * Only required inputs are offered, to keep the menu small, and widget-backed
 * types are skipped unless forced to a socket. Dynamic controls are descended
 * so a type nested in a DynamicCombo option or an Autogrow template is still
 * reachable, matching what node search reports.
 */
export function collectRegistrableSlotTypes(nodeData: ComfyNodeDef): {
  inputTypes: Set<string>
  outputTypes: string[]
} {
  const defV2 = transformNodeDefV1ToV2(nodeData)

  const inputTypes = new Set<string>()
  for (const rootSpec of Object.values(defV2.inputs)) {
    if (rootSpec.isOptional) continue
    for (const spec of inputSpecTree(rootSpec)) {
      if (spec.isOptional) continue
      for (const type of ownSlotTypes(spec)) {
        if (type in ComfyWidgets && !spec.forceInput) continue
        inputTypes.add(type)
      }
    }
  }

  return {
    inputTypes,
    outputTypes: collectSearchableOutputTypes(
      defV2.outputs,
      defV2.inputs,
      nodeData.output_matchtypes
    )
  }
}
