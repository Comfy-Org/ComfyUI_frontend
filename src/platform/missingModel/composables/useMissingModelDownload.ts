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
    downloadModel(model, store.folderPaths)
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
        if ((await bridge.openModelAccessPage(repoUrl)) === true) return
      } catch (error: unknown) {
        console.error('Failed to open model access page in Desktop:', error)
      }
    }

    openGatedRepoPage(repoUrl)
  }

  return {
    fileSizeFor,
    gatedRepoUrlFor,
    prefetchModelMetadata,
    downloadMissingModel,
    openModelAccessPage
  }
}
