import { api } from '@/scripts/api'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { NodeSourceType, getNodeSource } from '@/types/nodeSource'
import { extractCustomNodeName } from '@/workbench/utils/nodeHelpUtil'

class NodeHelpService {
  async fetchNodeHelp(node: ComfyNodeDefImpl, locale: string): Promise<string> {
    const nodeSource = getNodeSource(node.python_module)

    if (nodeSource.type === NodeSourceType.Blueprint) {
      return node.description || ''
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
  ): Promise<string> {
    const customNodeName = extractCustomNodeName(node.python_module)
    if (!customNodeName) {
      throw new Error('Invalid custom node module')
    }

    // Try locale-specific path first
    const localePath = `/extensions/${customNodeName}/docs/${node.name}/${locale}.md`
    const localeDoc = await this.tryFetchMarkdown(localePath)
    if (localeDoc) return localeDoc

    // Fall back to non-locale path
    const fallbackPath = `/extensions/${customNodeName}/docs/${node.name}.md`
    const fallbackDoc = await this.tryFetchMarkdown(fallbackPath)
    if (fallbackDoc) return fallbackDoc

    throw new Error('Help not found')
  }

  private async fetchCoreNodeHelp(
    node: ComfyNodeDefImpl,
    locale: string
  ): Promise<string> {
    const mdUrl = `/docs/${node.name}/${locale}.md`
    const doc = await this.tryFetchMarkdown(mdUrl)
    if (!doc) {
      throw new Error('Help not found')
    }

    return doc
  }

  /**
   * Fetch a markdown file and return its text, guarding against HTML/SPA fallbacks.
   * Returns null when not OK or when the content looks like HTML.
   */
  private async tryFetchMarkdown(path: string): Promise<string | null> {
    const res = await fetch(api.fileURL(path))

    if (!res.ok) {
      return null
    }

    const contentType = res.headers.get('content-type') ?? ''
    const text = await res.text()

    const looksHtml =
      contentType.includes('text/html') ||
      /^\s*<!doctype html/i.test(text) ||
      /^\s*<html/i.test(text)

    if (looksHtml) return null

    return text
  }
}

// Export singleton instance
export const nodeHelpService = new NodeHelpService()
