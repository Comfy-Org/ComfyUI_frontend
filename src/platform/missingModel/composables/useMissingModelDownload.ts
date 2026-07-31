import {
  downloadModel,
  fetchModelMetadata,
  isTrustedHuggingFaceUrl,
  openGatedRepoPage
} from '@/platform/missingModel/missingModelDownload'
import type { ModelWithUrl } from '@/platform/missingModel/missingModelDownload'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'

export function useMissingModelDownload() {
  const store = useMissingModelStore()

  async function prefetchModelMetadata(url: string): Promise<void> {
    if (store.fileSizes[url] !== undefined || store.gatedRepoUrls[url]) return

    const metadata = await fetchModelMetadata(url)
    if (metadata.fileSize !== null) {
      store.setFileSize(url, metadata.fileSize)
    }
    if (metadata.gatedRepoUrl) {
      store.setGatedRepoUrl(url, metadata.gatedRepoUrl)
    }
  }

  function downloadMissingModel(model: ModelWithUrl): void {
    downloadModel(model, store.folderPaths)
  }

  // Always try the bridge: it opens in the user's Electron session. isRemote()
  // describes the backend server, not the user, so it must not gate this. The
  // anchor fallback inside Electron hits shell.openExternal and strands the
  // provider cookies in the system browser.
  async function openModelAccessPage(repoUrl: string): Promise<void> {
    if (!isTrustedHuggingFaceUrl(repoUrl)) return

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
    prefetchModelMetadata,
    downloadMissingModel,
    openModelAccessPage
  }
}
