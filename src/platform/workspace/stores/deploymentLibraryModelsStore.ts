import { defineStore } from 'pinia'
import { effectScope, onScopeDispose, shallowReactive, watch } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { ComboWidgetInventoryStatus } from '@/core/graph/widgets/comboWidgetInventory'
import { assetService } from '@/platform/assets/services/assetService'
import { reportError } from '@comfyorg/telemetry/reportError'
import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAssetDownloadStore } from '@/stores/assetDownloadStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

interface LibraryFolder {
  names: readonly string[]
  status: ComboWidgetInventoryStatus
}

const NO_NAMES: readonly string[] = []

const WORKER_MODEL_FOLDERS = new Set([
  'checkpoints',
  'loras',
  'vae',
  'vae_approx',
  'controlnet',
  't2i_adapter',
  'clip',
  'clip_vision',
  'text_encoders',
  'diffusion_models',
  'unet',
  'upscale_models',
  'latent_upscale_models',
  'embeddings',
  'hypernetworks',
  'style_models',
  'gligen',
  'photomaker',
  'model_patches',
  'audio_encoders',
  'background_removal',
  'frame_interpolation',
  'geometry_estimation',
  'optical_flow',
  'detection'
])

/** The workspace library's model names by folder, offered after the Release's in a deployment's loader dropdowns. */
export const useDeploymentLibraryModelsStore = defineStore(
  'deploymentLibraryModels',
  () => {
    const { flags } = useFeatureFlags()
    const workspaceStore = useTeamWorkspaceStore()
    const deploymentPick = useDeploymentPickStore()
    const downloads = useAssetDownloadStore()
    const folders = shallowReactive(new Map<string, LibraryFolder>())
    const watchedFolders = new Map<string, number>()
    const latestRequest = new Map<string, number>()
    const listeners = effectScope()
    let generation = 0

    function loadWatchedFolders() {
      for (const folder of watchedFolders.keys()) {
        if (!folders.has(folder)) refresh(folder)
      }
    }

    watch(
      () => workspaceStore.workspaceId,
      () => {
        generation++
        folders.clear()
        latestRequest.clear()
        loadWatchedFolders()
      },
      { flush: 'sync' }
    )

    watch(
      () => flags.runtimeLibraryModelsEnabled,
      (enabled) => {
        if (enabled) {
          loadWatchedFolders()
          return
        }
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
      assetService.onAssetsChanged(() => {
        for (const folder of folders.keys()) refresh(folder)
      })
    )

    function deploymentDownloads(folder: string, name?: string): boolean {
      return pendingServerFact(
        'BE-24448',
        !!deploymentPick.bootDeployment &&
          WORKER_MODEL_FOLDERS.has(folder) &&
          (name === undefined ||
            (!name.startsWith('.') &&
              !/[/\\\0]/.test(name) &&
              !name.includes('..') &&
              name.toLowerCase().endsWith('.safetensors')))
      )
    }

    function folderFor(nodeType: string, widgetName: string) {
      if (!assetService.isAssetBrowserEligible(nodeType, widgetName)) {
        return undefined
      }
      const folder = useModelToNodeStore().getCategoryForNodeType(nodeType)
      return folder && deploymentDownloads(folder) ? folder : undefined
    }

    function refresh(folder: string) {
      if (!flags.runtimeLibraryModelsEnabled || !workspaceStore.workspaceId) {
        return
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
          folders.set(folder, {
            names: names.filter((name) => deploymentDownloads(folder, name)),
            status: 'ready'
          })
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

    function loaded(folder: string): LibraryFolder | undefined {
      return flags.runtimeLibraryModelsEnabled ? folders.get(folder) : undefined
    }

    function namesIn(folder: string): readonly string[] {
      return loaded(folder)?.names ?? NO_NAMES
    }

    function statusOf(folder: string): ComboWidgetInventoryStatus {
      return loaded(folder)?.status ?? 'ready'
    }

    /**
     * Loads the folder and calls back each time its names change, until the returned stop is called.
     */
    function watchFolder(folder: string, onChange: () => void): () => void {
      watchedFolders.set(folder, (watchedFolders.get(folder) ?? 0) + 1)
      if (!folders.has(folder)) refresh(folder)
      const stopWatch = listeners.run(() =>
        watch(() => namesIn(folder), onChange)
      )
      let stopped = false
      return () => {
        if (stopped) return
        stopped = true
        stopWatch?.()
        const count = (watchedFolders.get(folder) ?? 1) - 1
        if (count > 0) watchedFolders.set(folder, count)
        else watchedFolders.delete(folder)
      }
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
      watchFolder,
      namesIn,
      statusOf,
      waitForSettled,
      refresh
    }
  }
)
