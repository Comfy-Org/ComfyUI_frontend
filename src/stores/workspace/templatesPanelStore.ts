import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { TemplateLibraryMetadata } from '@/platform/telemetry/types'

/**
 * Cross-cutting state for the docked templates panel. Entry points that used
 * to open the templates modal (menu, commands, welcome screens) stash the
 * open context here; the panel component consumes it on mount so category
 * deep-links, close callbacks, and telemetry sources keep working.
 */
export const useTemplatesPanelStore = defineStore('templatesPanel', () => {
  const requestedCategory = ref<string | null>(null)
  const openSource = ref<TemplateLibraryMetadata['source']>('sidebar')
  const afterClose = ref<(() => void) | null>(null)

  const setOpenContext = (
    source: TemplateLibraryMetadata['source'],
    options?: { initialCategory?: string; afterClose?: () => void }
  ) => {
    openSource.value = source
    requestedCategory.value = options?.initialCategory ?? null
    afterClose.value = options?.afterClose ?? null
  }

  /** One-shot read of the requested category (deep-links from entry points). */
  const consumeRequestedCategory = () => {
    const category = requestedCategory.value
    requestedCategory.value = null
    return category
  }

  /** One-shot read of the open source for the panel-opened telemetry event. */
  const consumeOpenSource = () => {
    const source = openSource.value
    openSource.value = 'sidebar'
    return source
  }

  /** Invoke and clear the pending close callback (runs when the panel unmounts). */
  const runAfterClose = () => {
    const callback = afterClose.value
    afterClose.value = null
    callback?.()
  }

  return {
    setOpenContext,
    consumeRequestedCategory,
    consumeOpenSource,
    runAfterClose
  }
})
