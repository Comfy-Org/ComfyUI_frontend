interface DirectAssetDownload {
  mode: 'direct'
  url: string
  filename: string
}

export interface FetchedAssetDownload {
  mode: 'fetch'
  url: string
  filename: string
  fetch?: (url: string) => Promise<Response>
  preferResponseFilename?: boolean
}

export type AssetFileDownload = DirectAssetDownload | FetchedAssetDownload
