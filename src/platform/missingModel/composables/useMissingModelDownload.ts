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

    try {
      const metadata = await fetchModelMetadata(url)
      if (metadata.fileSize !== null) {
        store.setFileSize(url, metadata.fileSize)
      }
      if (metadata.gatedRepoUrl) {
        store.setGatedRepoUrl(url, metadata.gatedRepoUrl)
      }
    } catch (error: unknown) {
      console.warn(
        `[MissingModelDownload] Failed to fetch metadata for ${url}:`,
        error
      )
    }
  }

  function downloadMissingModel(model: ModelWithUrl): void {
    const gatedRepoUrl = store.gatedRepoUrls[model.url]
    if (gatedRepoUrl) {
      openGatedRepoPage(gatedRepoUrl)
      return
    }

    downloadModel(model, store.folderPaths)
  }

  return {
    prefetchModelMetadata,
    downloadMissingModel
  }
}
