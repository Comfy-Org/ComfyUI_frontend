import type { MaybeRefOrGetter } from 'vue'
import { computed, ref, toValue, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { nodeHelpService } from '@/services/nodeHelpService'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'
import { getNodeHelpBaseUrl } from '@/workbench/utils/nodeHelpUtil'

/**
 * Composable for fetching and rendering node help content.
 * Creates independent state for each usage, allowing multiple panels
 * to show help content without interfering with each other.
 *
 * @param nodeRef - Reactive reference to the node to show help for
 * @returns Reactive help content state and rendered HTML
 */
export function useNodeHelpContent(
  nodeRef: MaybeRefOrGetter<ComfyNodeDefImpl | null>
) {
  const { locale } = useI18n()

  const helpContent = ref<string>('')
  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)

  const baseUrl = computed(() => {
    const node = toValue(nodeRef)
    if (!node) return ''
    return getNodeHelpBaseUrl(node)
  })

  const renderedHelpHtml = computed(() => {
    return renderMarkdownToHtml(helpContent.value, baseUrl.value)
  })

  // Watch for node changes and fetch help content
  watch(
    () => toValue(nodeRef),
    async (node) => {
      helpContent.value = ''
      error.value = null

      if (node) {
        isLoading.value = true
        try {
          helpContent.value = await nodeHelpService.fetchNodeHelp(
            node,
            locale.value || 'en'
          )
        } catch (e: unknown) {
          error.value = e instanceof Error ? e.message : String(e)
          helpContent.value = node.description || ''
        } finally {
          isLoading.value = false
        }
      }
    },
    { immediate: true }
  )

  return {
    helpContent,
    isLoading,
    error,
    baseUrl,
    renderedHelpHtml
  }
}
