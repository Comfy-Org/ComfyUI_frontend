import { api } from '@/scripts/api'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { NodeSourceType, getNodeSource } from '@/types/nodeSource'
import { extractCustomNodeName } from '@/utils/nodeDocsUtil'

export class NodeDocsService {
  async fetchNodeDocs(node: ComfyNodeDefImpl, locale: string): Promise<string> {
    const nodeSource = getNodeSource(node.python_module)

    if (nodeSource.type === NodeSourceType.CustomNodes) {
      return this.fetchCustomNodeDocs(node, locale)
    } else {
      return this.fetchCoreNodeDocs(node, locale)
    }
  }

  private async fetchCustomNodeDocs(
    node: ComfyNodeDefImpl,
    locale: string
  ): Promise<string> {
    const customNodeName = extractCustomNodeName(node.python_module)
    if (!customNodeName) {
      throw new Error('Invalid custom node module')
    }

    // Try locale-specific path first
    const localePath = `/extensions/${customNodeName}/docs/${node.name}/${locale}.md`
    let res = await fetch(api.fileURL(localePath))

    if (!res.ok) {
      // Fall back to non-locale path
      const fallbackPath = `/extensions/${customNodeName}/docs/${node.name}.md`
      res = await fetch(api.fileURL(fallbackPath))
    }

    if (!res.ok) {
      throw new Error(res.statusText)
    }

    return res.text()
  }

  private async fetchCoreNodeDocs(
    node: ComfyNodeDefImpl,
    locale: string
  ): Promise<string> {
    const mdUrl = `/docs/${node.name}/${locale}.md`
    const res = await fetch(api.fileURL(mdUrl))

    if (!res.ok) {
      throw new Error(res.statusText)
    }

    return res.text()
  }
}

// Export singleton instance
export const nodeDocsService = new NodeDocsService()
