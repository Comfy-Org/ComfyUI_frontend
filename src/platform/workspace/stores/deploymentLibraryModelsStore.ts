import { defineStore } from 'pinia'
import { shallowReactive, watch } from 'vue'

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
  settled: Promise<void>
}

const NO_NAMES: readonly string[] = []

/**
 * Every member's private models in the workspace library, by model folder, offered after the
 * Release's models in the loader dropdowns of a page booted on a deployment
 * while the runtime library models flag is on.
 */
export const useDeploymentLibraryModelsStore = defineStore(
  'deploymentLibraryModels',
  () => {
    const { flags } = useFeatureFlags()
    const workspaceStore = useTeamWorkspaceStore()
    const deploymentPick = useDeploymentPickStore()
    const downloads = useAssetDownloadStore()
    const folders = shallowReactive(new Map<string, LibraryFolder>())
    const latestRequest = new Map<string, number>()
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

    /** The library folder a loader input offers on a deployment, else undefined. */
    function folderFor(nodeType: string, widgetName: string) {
      if (!deploymentPick.bootDeployment) return undefined
      if (!assetService.isAssetBrowserEligible(nodeType, widgetName)) {
        return undefined
      }
      return useModelToNodeStore().getCategoryForNodeType(nodeType)
    }

    /** Reads the folder again, keeping its names shown until the answer. */
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
        status: previous?.status === 'ready' ? 'ready' : 'loading',
        settled: assetService.getWorkspaceLibraryModels(folder).then(
          (names) => {
            if (!isCurrent()) return
            folders.set(folder, { ...entry, names, status: 'ready' })
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
      }
      folders.set(folder, entry)
      return entry
    }

    function current(folder: string): LibraryFolder | undefined {
      if (!flags.runtimeLibraryModelsEnabled) return undefined
      return folders.get(folder) ?? refresh(folder)
    }

    /** Starts reading the folder unless it was read already. */
    function prepare(folder: string) {
      current(folder)
    }

    /** The folder's library model names, loading them on first read. */
    function namesIn(folder: string): readonly string[] {
      return current(folder)?.names ?? NO_NAMES
    }

    function statusOf(folder: string): ComboWidgetInventoryStatus {
      return current(folder)?.status ?? 'ready'
    }

    async function waitForSettled(folder: string): Promise<void> {
      let entry = current(folder)
      while (entry) {
        await entry.settled
        const next = folders.get(folder)
        if (next === entry || next?.status !== 'loading') return
        entry = next
      }
    }

    return {
      folderFor,
      prepare,
      namesIn,
      statusOf,
      waitForSettled,
      refresh
    }
  }
)
