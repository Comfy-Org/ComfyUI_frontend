import type { WorkflowJson, RequiredNodeInfo } from '../types'
import { identifyRequiredNodes } from '../../../src/lib/node-registry'

export function extractRequiredNodes(
  workflow: WorkflowJson
): RequiredNodeInfo[] {
  const nodes = identifyRequiredNodes(workflow)
  return nodes.map(({ nodeType, info }) => ({
    nodeType,
    package: info.package,
    url: info.url,
    description: info.description
  }))
}
