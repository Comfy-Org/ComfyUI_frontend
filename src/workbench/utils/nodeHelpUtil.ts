import type { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import { NodeSourceType } from '@/types/nodeSource'
import { extractCustomNodeName } from '@/platform/customNodes/manager/utils/packUtils'

export function getNodeHelpBaseUrl(node: ComfyNodeDefImpl): string {
  if (node.python_module.split('.')[0] === 'blueprint') {
    return ''
  }
  if (node.nodeSource.type === NodeSourceType.CustomNodes) {
    const customNodeName = extractCustomNodeName(node.python_module)
    if (customNodeName) {
      return `/extensions/${customNodeName}/docs/`
    }
  }
  return `/docs/${node.name}/`
}
