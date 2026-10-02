import { computed } from 'vue'
import { api } from '@/scripts/api'
import { isCloud, isDesktop } from '@/platform/distribution/types'
import { useMissingModelDownloadStore } from '@/platform/missingModel/missingModelDownloadStore'
import {
  downloadModel,
  isTrustedHuggingFaceUrl,
  openGatedRepoPage
} from '@/platform/missingModel/missingModelDownload'
import type { ModelWithUrl } from '@/platform/missingModel/missingModelDownload'
import { fetchAndStoreModelMetadata } from '@/platform/missingModel/missingModelMetadata'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'

export function useMissingModelDownload() {
  const store = useMissingModelStore()
  const downloads = useMissingModelDownloadStore()
  const usesServerDownloads = computed(() => {
    const bridge = window.__comfyDesktop2
    const remote = bridge?.isRemote?.() ?? window.__comfyDesktop2Remote ?? false
    const nativeDownload = !remote && (isDesktop || !!bridge?.downloadModel)
    return (
      !isCloud &&
      !nativeDownload &&
      api.getServerFeature<boolean>('supports_missing_model_downloads', false)
    )
  })
  const isDownloading = computed(
    () => usesServerDownloads.value && downloads.isDownloading
  )

  function fileSizeFor(url: string): number | undefined {
    return store.fileSizes[url]
  }

  function gatedRepoUrlFor(url: string): string | undefined {
    return store.gatedRepoUrls[url]
  }

  async function prefetchModelMetadata(url: string): Promise<void> {
    if (fileSizeFor(url) !== undefined || gatedRepoUrlFor(url)) return

    await fetchAndStoreModelMetadata(url, store)
  }

  function downloadMissingModel(model: ModelWithUrl): void {
    downloadMissingModels([model])
  }

  function downloadMissingModels(models: ModelWithUrl[]): void {
    if (isCloud) return
    if (usesServerDownloads.value) {
      void downloads.start(models)
    } else {
      for (const model of models) downloadModel(model, store.folderPaths)
    }
  }

  // Always try the bridge: it opens in the user's Electron session. isRemote()
  // describes the backend server, not the user, so it must not gate this. The
  // anchor fallback inside Electron hits shell.openExternal and strands the
  // provider cookies in the system browser.
  async function openModelAccessPage(repoUrl: string): Promise<void> {
    if (!isTrustedHuggingFaceUrl(repoUrl)) {
      console.warn('[missingModelDownload] Blocked untrusted access URL')
      return
    }

    const bridge = window.__comfyDesktop2
    if (bridge?.openModelAccessPage) {
      try {
        if (await bridge.openModelAccessPage(repoUrl)) return
      } catch (error: unknown) {
        console.error('Failed to open model access page in Desktop:', error)
      }
    }

    openGatedRepoPage(repoUrl)
  }

  return {
    usesServerDownloads,
    isDownloading,
    serverDownloadState: downloads.stateFor,
    cancelServerDownload: downloads.cancel,
    downloadMissingModels,
    fileSizeFor,
    gatedRepoUrlFor,
    prefetchModelMetadata,
    downloadMissingModel,
    openModelAccessPage
  }
}
