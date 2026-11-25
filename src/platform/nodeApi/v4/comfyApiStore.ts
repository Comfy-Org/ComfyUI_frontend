import { once } from 'es-toolkit'
import { defineStore } from 'pinia'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useExtensionService } from '@/platform/extensions/services/extensionService'

import { isGraphLoading } from '@/core/graph/graphLoadState'
import { api } from '@/scripts/api'
import { useApp } from '@/scripts/appInstance'
import { isChangeCaptureSuppressed } from '@/services/changeCaptureSuppression'

import { createComfyApi } from './comfyApi'

/** The app's one V4 node API, and the host's side of it. */
export const useComfyApiStore = defineStore('comfyApiV4', () => {
  const { comfy, host } = createComfyApi({
    getGraph: () => useApp().canvasOrUndefined?.graph ?? null,
    history: () => useWorkflowStore().activeWorkflow?.changeTracker,
    isLoading: () =>
      isGraphLoading(useApp().rootGraphOrUndefined) ||
      isChangeCaptureSuppressed(),
    extensionsUrl: () =>
      new URL(api.fileURL('/extensions/'), window.location.href).href
  })

  const installNodeTypeHooks = once(() =>
    useExtensionService().registerExtension(host.nodeTypeHooks)
  )

  function publish(): void {
    host.markStarting()
    Object.defineProperty(window, 'comfy_v4', {
      value: comfy,
      enumerable: true,
      configurable: true
    })
    installNodeTypeHooks()
  }

  return {
    publish,
    reapplyTypeColors: host.reapplyTypeColors,
    markReady: host.markReady,
    providePacks: host.providePacks,
    endDocument: host.endDocument,
    beginDocument: host.beginDocument,
    beforeHistoryRestore: host.beforeHistoryRestore,
    afterHistoryRestore: host.afterHistoryRestore
  }
})
