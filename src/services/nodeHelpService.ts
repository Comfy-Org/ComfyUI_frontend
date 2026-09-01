import { api } from '@/scripts/api'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { NodeSourceType, getNodeSource } from '@/types/nodeSource'
import { extractCustomNodeName } from '@/workbench/utils/nodeHelpUtil'

class NodeHelpService {
  async fetchNodeHelp(
    node: ComfyNodeDefImpl,
    locale: string
  ): Promise<string | undefined> {
    const nodeSource = getNodeSource(node.python_module)

    if (nodeSource.type === NodeSourceType.Blueprint) {
      return node.description || undefined
    }

    if (nodeSource.type === NodeSourceType.CustomNodes) {
      return this.fetchCustomNodeHelp(node, locale)
    } else {
      return this.fetchCoreNodeHelp(node, locale)
    }
  }

  private async fetchCustomNodeHelp(
    node: ComfyNodeDefImpl,
    locale: string
  ): Promise<string | undefined> {
    const customNodeName = extractCustomNodeName(node.python_module)
    if (!customNodeName) {
      console.warn('Invalid custom node module:', node.python_module)
      return undefined
    }

    // Try locale-specific path first
    const localePath = `/extensions/${customNodeName}/docs/${node.name}/${locale}.md`
    let localeError: unknown
    let localeDoc: string | undefined
    try {
      localeDoc = await this.tryFetchMarkdown(localePath)
    } catch (error) {
      localeError = error
    }
    if (localeDoc) return localeDoc

    // Fall back to non-locale path
    const fallbackPath = `/extensions/${customNodeName}/docs/${node.name}.md`
    const fallbackDoc = await this.tryFetchMarkdown(fallbackPath)
    if (fallbackDoc) return fallbackDoc
    if (localeError) throw localeError
    return undefined
  }

  private async fetchCoreNodeHelp(
    node: ComfyNodeDefImpl,
    locale: string
  ): Promise<string | undefined> {
    const mdUrl = `/docs/${node.name}/${locale}.md`
    return (await this.tryFetchMarkdown(mdUrl)) || undefined
  }

  /**
   * Fetch a markdown file and return its text, guarding against HTML/SPA fallbacks.
   * Returns undefined when the file is absent or the response is HTML.
   */
  private async tryFetchMarkdown(path: string): Promise<string | undefined> {
    const res = await fetch(api.fileURL(path))

    if (res.status === 404) {
      return undefined
    }
    if (!res.ok) {
      console.warn(
        `nodeHelpService: failed to fetch markdown (${res.status} ${res.statusText}) at ${path}`
      )
      return undefined
    }

    const contentType = res.headers?.get?.('content-type') ?? ''
    const text = await res.text()

    const isHtmlContentType = contentType.includes('text/html')

    if (isHtmlContentType) return undefined

    return text
  }
}

// Export singleton instance
export const nodeHelpService = new NodeHelpService()
