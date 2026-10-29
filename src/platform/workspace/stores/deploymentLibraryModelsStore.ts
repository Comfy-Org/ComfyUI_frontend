import { defineStore } from 'pinia'
import { effectScope, onScopeDispose, shallowReactive, watch } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { ComboWidgetInventoryStatus } from '@/core/graph/widgets/comboWidgetInventory'
import { assetService } from '@/platform/assets/services/assetService'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAssetDownloadStore } from '@/stores/assetDownloadStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

interface LibraryFolder {
  names: readonly string[]
  status: ComboWidgetInventoryStatus
}

const NO_NAMES: readonly string[] = []

/** The workspace library's model names by folder, offered after the Release's in a deployment's loader dropdowns. */
export const useDeploymentLibraryModelsStore = defineStore(
  'deploymentLibraryModels',
  () => {
    const { flags } = useFeatureFlags()
    const workspaceStore = useTeamWorkspaceStore()
    const deploymentPick = useDeploymentPickStore()
    const downloads = useAssetDownloadStore()
    const folders = shallowReactive(new Map<string, LibraryFolder>())
    const latestRequest = new Map<string, number>()
    const listeners = effectScope()
    let generation = 0

    watch(
      () => workspaceStore.workspaceId,
      () => {
        generation++
        folders.clear()
        latestRequest.clear()
      },
      { flush: 'sync' }
    )

    watch(
      () => downloads.lastCompletedDownload,
      (completed) => {
        if (!completed || !folders.has(completed.modelType)) return
        refresh(completed.modelType)
      }
    )

    onScopeDispose(
      assetService.onAssetDeleted(() => {
        for (const folder of folders.keys()) refresh(folder)
      })
    )

    function folderFor(nodeType: string, widgetName: string) {
      if (!deploymentPick.bootDeployment) return undefined
      if (!assetService.isAssetBrowserEligible(nodeType, widgetName)) {
        return undefined
      }
      return useModelToNodeStore().getCategoryForNodeType(nodeType)
    }

    function refresh(folder: string): LibraryFolder | undefined {
      if (!flags.runtimeLibraryModelsEnabled || !workspaceStore.workspaceId) {
        return undefined
      }
      const startedIn = generation
      const request = (latestRequest.get(folder) ?? 0) + 1
      latestRequest.set(folder, request)
      const isCurrent = () =>
        startedIn === generation && latestRequest.get(folder) === request
      const previous = folders.get(folder)
      const entry: LibraryFolder = {
        names: previous?.names ?? NO_NAMES,
        status: previous?.status === 'ready' ? 'ready' : 'loading'
      }
      folders.set(folder, entry)
      void assetService.getWorkspaceLibraryModels(folder).then(
        (names) => {
          if (!isCurrent()) return
          folders.set(folder, { names, status: 'ready' })
        },
        (err: unknown) => {
          if (!isCurrent()) return
          folders.set(folder, { ...entry, status: 'error' })
          reportError(err, {
            surface: 'workspace',
            errorType: 'error_loading_library_models',
            level: 'warning',
            tags: { folder }
          })
        }
      )
      return entry
    }

    function current(folder: string): LibraryFolder | undefined {
      if (!flags.runtimeLibraryModelsEnabled) return undefined
      return folders.get(folder) ?? refresh(folder)
    }

    function prepare(folder: string) {
      current(folder)
    }

    function namesIn(folder: string): readonly string[] {
      return current(folder)?.names ?? NO_NAMES
    }

    function onNamesChange(folder: string, callback: () => void): () => void {
      const stop = listeners.run(() => watch(() => namesIn(folder), callback))
      return stop ?? (() => {})
    }

    function statusOf(folder: string): ComboWidgetInventoryStatus {
      return current(folder)?.status ?? 'ready'
    }

    function waitForSettled(folder: string): Promise<void> {
      if (statusOf(folder) !== 'loading') return Promise.resolve()
      return new Promise((resolve) => {
        const stop = listeners.run(() =>
          watch(
            () => [flags.runtimeLibraryModelsEnabled, folders.get(folder)],
            () => {
              if (statusOf(folder) === 'loading') return
              stop?.()
              resolve()
            }
          )
        )
        if (!stop) resolve()
      })
    }

    return {
      folderFor,
      prepare,
      namesIn,
      onNamesChange,
      statusOf,
      waitForSettled,
      refresh
    }
  }
)
