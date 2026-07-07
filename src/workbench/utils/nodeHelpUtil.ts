import { NodeSourceType, getNodeSource } from '@/types/nodeSource'
import { normalizePackId } from '@/utils/packUtils'

export function extractCustomNodeName(
  pythonModule: string | undefined
): string | null {
  const modules = pythonModule?.split('.') || []
  if (modules.length >= 2 && modules[0] === 'custom_nodes') {
    return normalizePackId(modules[1])
  }
  return null
}

export function getNodeHelpBaseUrl(node: {
  name: string
  python_module: string
}): string {
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
