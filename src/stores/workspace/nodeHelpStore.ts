import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { i18n } from '@/i18n'
import { nodeHelpService } from '@/services/nodeHelpService'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'
import { getNodeHelpBaseUrl } from '@/utils/nodeHelpUtil'

export const useNodeHelpStore = defineStore('nodeHelp', () => {
  const currentHelpNode = ref<ComfyNodeDefImpl | null>(null)
  const isHelpOpen = computed(() => currentHelpNode.value !== null)
  const helpContent = ref<string>('')
  const isLoading = ref<boolean>(false)
  const errorMsg = ref<string | null>(null)

  function openHelp(nodeDef: ComfyNodeDefImpl) {
    currentHelpNode.value = nodeDef
  }

  function closeHelp() {
    currentHelpNode.value = null
  }

  // Base URL for relative assets in node docs markdown
  const baseUrl = computed(() => {
    const node = currentHelpNode.value
    if (!node) return ''
    return getNodeHelpBaseUrl(node)
  })

  // Watch for help node changes and fetch its docs markdown
  watch(
    () => currentHelpNode.value,
    async (node) => {
      helpContent.value = ''
      errorMsg.value = null

      if (node) {
        isLoading.value = true
        try {
          const locale = i18n.global.locale.value || 'en'
          helpContent.value = await nodeHelpService.fetchNodeHelp(node, locale)
        } catch (e: any) {
          errorMsg.value = e.message
          helpContent.value = node.description || ''
        } finally {
          isLoading.value = false
        }
      }
    },
    { immediate: true }
  )

  const renderedHelpHtml = computed(() => {
    return renderMarkdownToHtml(helpContent.value, baseUrl.value)
  })

  return {
    currentHelpNode,
    isHelpOpen,
    openHelp,
    closeHelp,
    baseUrl,
    renderedHelpHtml,
    isLoading,
    error: errorMsg
  }
})
