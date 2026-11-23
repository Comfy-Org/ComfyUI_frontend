import type { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import { NodeSourceType, getNodeSource } from '@/types/nodeSource'
import { extractCustomNodeName } from '@/platform/customNodes/manager/utils/packUtils'

export function getNodeHelpBaseUrl(node: ComfyNodeDefImpl): string {
  const nodeSource = getNodeSource(node.python_module)
  if (nodeSource.type === NodeSourceType.Blueprint) {
    return ''
  }
  if (nodeSource.type === NodeSourceType.CustomNodes) {
    const customNodeName = extractCustomNodeName(node.python_module)
    if (customNodeName) {
      return `/extensions/${customNodeName}/docs/`
    }
  }
  return `/docs/${node.name}/`
}
