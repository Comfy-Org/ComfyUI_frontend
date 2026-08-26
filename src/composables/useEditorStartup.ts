import { computed, onMounted, watch } from 'vue'

import { flushProxyWidgetMigration } from '@/core/graph/subgraph/migration/proxyWidgetMigration'
import { autoExposeKnownPreviewNodes } from '@/core/graph/subgraph/promotionUtils'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useBootstrapStore } from '@/stores/bootstrapStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

import '@/assets/css/editor.css'

let storeBootstrapStarted = false
let backgroundStartup: Promise<void> | undefined

function startBackgroundEditorTasks(): Promise<void> {
  backgroundStartup ??=
    import('@/workbench/extensions/manager/composables/useConflictDetection').then(
      ({ useConflictDetection }) =>
        useConflictDetection().initializeConflictDetection()
    )
  return backgroundStartup
}

export function useEditorStartup() {
  const workspaceStore = useWorkspaceStore()
  const bootstrapStore = useBootstrapStore()

  app.extensionManager = workspaceStore
  LGraph.proxyWidgetMigrationFlush = (hostNode, nodeData) =>
    flushProxyWidgetMigration({
      hostNode,
      hostWidgetValues: nodeData?.widgets_values
    })
  LGraph.autoExposePreviewNodes = (hostNode) =>
    autoExposeKnownPreviewNodes(hostNode)

  if (!storeBootstrapStarted) {
    storeBootstrapStarted = true
    void bootstrapStore.startStoreBootstrap()
  }

  onMounted(() => {
    void startBackgroundEditorTasks()
  })

  const isLoading = computed(() => workspaceStore.spinner)
  watch(
    isLoading,
    (loading, previousLoading) => {
      if (previousLoading && !loading) {
        document.getElementById('splash-loader')?.remove()
      }
    },
    { flush: 'post' }
  )

  return { isLoading }
}
