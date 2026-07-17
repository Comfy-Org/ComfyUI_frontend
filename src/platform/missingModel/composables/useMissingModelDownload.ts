import {
  downloadModel,
  fetchModelMetadata,
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

  // Use the bridge regardless of isRemote() so provider cookies land in the
  // host session reused by downloads.
  async function openModelAccessPage(repoUrl: string): Promise<void> {
    const openInHost = window.__comfyDesktop2?.openModelAccessPage
    if (openInHost) {
      try {
        if (await openInHost(repoUrl)) return
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
