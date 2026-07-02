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
      } else if (metadata.gatedRepoUrl) {
        store.setGatedRepoUrl(url, metadata.gatedRepoUrl)
      }
    } catch (error: unknown) {
      console.warn(
        `[MissingModelDownload] Failed to fetch metadata for ${url}:`,
        error
      )
    }
  }

  async function downloadMissingModel(model: ModelWithUrl): Promise<void> {
    const gatedRepoUrl = store.gatedRepoUrls[model.url]
    if (gatedRepoUrl) {
      let repoUrl = gatedRepoUrl
      try {
        const metadata = await fetchModelMetadata(model.url)
        if (metadata.fileSize !== null) {
          store.setFileSize(model.url, metadata.fileSize)
          downloadModel(model, store.folderPaths)
          return
        }
        if (metadata.gatedRepoUrl) {
          store.setGatedRepoUrl(model.url, metadata.gatedRepoUrl)
          repoUrl = metadata.gatedRepoUrl
        }
      } catch (error: unknown) {
        console.warn(
          `[MissingModelDownload] Failed to revalidate gated metadata for ${model.url}:`,
          error
        )
      }

      openGatedRepoPage(repoUrl)
      return
    }

    downloadModel(model, store.folderPaths)
  }

  return {
    prefetchModelMetadata,
    downloadMissingModel
  }
}
