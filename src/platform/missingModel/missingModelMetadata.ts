import { fetchModelMetadata } from '@/platform/missingModel/missingModelDownload'

interface MissingModelMetadataStore {
  setFileSize: (url: string, size: number) => void
  setGatedRepoUrl: (url: string, repoUrl: string) => void
}

export async function fetchAndStoreModelMetadata(
  url: string,
  store: MissingModelMetadataStore,
  signal?: AbortSignal
): Promise<void> {
  const metadata = await fetchModelMetadata(url)
  if (!signal?.aborted && metadata.fileSize !== null) {
    store.setFileSize(url, metadata.fileSize)
  }
  if (!signal?.aborted && metadata.gatedRepoUrl) {
    store.setGatedRepoUrl(url, metadata.gatedRepoUrl)
  }
}
