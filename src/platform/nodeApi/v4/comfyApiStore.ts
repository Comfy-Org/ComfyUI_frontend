import { once } from 'es-toolkit'
import { defineStore } from 'pinia'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useExtensionService } from '@/platform/extensions/services/extensionService'

import { useApp } from '@/scripts/appInstance'

import type { CanvasSource } from './canvasSource'
import { createComfyApi } from './comfyApi'

/** The app's one V4 node API, and the host's side of it. */
export const useComfyApiStore = defineStore('comfyApiV4', () => {
  let canvas: CanvasSource | undefined
  const { comfy, host } = createComfyApi({
    canvas: () => canvas,
    getGraph: () => useApp().canvasOrUndefined?.graph ?? null,
    history: () => useWorkflowStore().activeWorkflow?.changeTracker
  })

  const installNodeTypeHooks = once(() =>
    useExtensionService().registerExtension(host.nodeTypeHooks)
  )

  function provideCanvas(source: CanvasSource): void {
    canvas = source
  }

  function publish(): void {
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
    workflowLoaded: host.workflowLoaded,
    importWorkflowFile: host.importWorkflowFile,
    queue: host.queue,
    reapplyTypeColors: host.reapplyTypeColors,
    frontendExecution: host.frontendExecution,
    deliverPreview: host.deliverPreview,
    markReady: host.markReady,
    beginDocument: host.beginDocument,
    afterHistoryRestore: host.afterHistoryRestore
  }
})
