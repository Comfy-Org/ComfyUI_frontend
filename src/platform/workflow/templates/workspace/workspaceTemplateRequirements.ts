import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'

import { flattenWorkflowNodes } from '@/platform/workflow/core/utils/workflowFlattening'
import { extractTemplateModelRequirementDetails } from '@/platform/workflow/templates/utils/templateModelRequirements'

import type { WorkspaceTemplateRequirements } from './workspaceTemplateTypes'

interface NodeDefFacts {
  api_node: boolean
  python_module: string
}

const CUSTOM_NODES_MODULE_PREFIX = 'custom_nodes.'

function customNodePackage(pythonModule: string): string | undefined {
  if (!pythonModule.startsWith(CUSTOM_NODES_MODULE_PREFIX)) return undefined
  const [packageName] = pythonModule
    .slice(CUSTOM_NODES_MODULE_PREFIX.length)
    .split('.')
  return packageName.split('@')[0] || undefined
}

/** What a workflow needs to run, derived once when it becomes a template. */
export function deriveWorkspaceTemplateRequirements(
  workflow: ComfyWorkflowJSON,
  lookupNodeDef: (nodeType: string) => NodeDefFacts | undefined
): WorkspaceTemplateRequirements {
  const models = extractTemplateModelRequirementDetails(workflow).map(
    ({ model }) => ({ name: model.name, directory: model.directory })
  )

  const packages = new Map<string, Set<string>>()
  let usesPartnerNodes = false
  for (const node of flattenWorkflowNodes(workflow)) {
    const nodeDef = lookupNodeDef(node.type)
    if (!nodeDef) continue
    if (nodeDef.api_node) usesPartnerNodes = true
    const packageName = customNodePackage(nodeDef.python_module)
    if (!packageName) continue
    const nodeTypes = packages.get(packageName) ?? new Set<string>()
    nodeTypes.add(node.type)
    packages.set(packageName, nodeTypes)
  }

  return {
    models,
    custom_nodes: [...packages.entries()].map(([packageName, nodeTypes]) => ({
      package: packageName,
      node_types: [...nodeTypes]
    })),
    uses_partner_nodes: usesPartnerNodes,
    is_app: workflow.extra?.linearMode === true
  }
}
