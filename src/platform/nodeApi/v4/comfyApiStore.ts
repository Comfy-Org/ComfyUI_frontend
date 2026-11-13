import { once } from 'es-toolkit'
import { defineStore } from 'pinia'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useExtensionService } from '@/platform/extensions/services/extensionService'

import { isGraphLoading } from '@/core/graph/graphLoadState'
import { api } from '@/scripts/api'
import { useApp } from '@/scripts/appInstance'
import { isChangeCaptureSuppressed } from '@/services/changeCaptureSuppression'

import type { CanvasSource } from './canvasSource'
import { createComfyApi } from './comfyApi'

export const useComfyApiStore = defineStore('comfyApiV4', () => {
  let canvas: CanvasSource | undefined
  const { comfy, host } = createComfyApi({
    canvas: () => canvas,
    getGraph: () => useApp().canvasOrUndefined?.graph ?? null,
    history: () => useWorkflowStore().activeWorkflow?.changeTracker,
    isLoading: () =>
      isGraphLoading(useApp().rootGraphOrUndefined) ||
      isChangeCaptureSuppressed(),
    shownRoot: () => useApp().rootGraphOrUndefined,
    extensionsUrl: () =>
      new URL(api.fileURL('/extensions/'), window.location.href).href
  })

  const installNodeTypeHooks = once(() =>
    useExtensionService().registerExtension(host.nodeTypeHooks)
  )

  function provideCanvas(source: CanvasSource): void {
    canvas = source
  }

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
    provideCanvas,
    reapplyTypeColors: host.reapplyTypeColors,
    markReady: host.markReady,
    providePacks: host.providePacks,
    endDocument: host.endDocument,
    loadEnded: host.loadEnded,
    beginDocument: host.beginDocument,
    beforeHistoryRestore: host.beforeHistoryRestore,
    afterHistoryRestore: host.afterHistoryRestore
  }
})
