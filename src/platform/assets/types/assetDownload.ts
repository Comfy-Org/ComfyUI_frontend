import type { AuthCredential } from '@comfyorg/api-client/authTypes'

interface DirectAssetDownload {
  mode: 'direct'
  url: string
  filename: string
}

export interface FetchedAssetDownload {
  mode: 'fetch'
  url: string
  filename: string
  fetch?: (
    url: string,
    onAuthCredential: (credential: AuthCredential) => void
  ) => Promise<Response>
  preferResponseFilename?: boolean
  surface?: string
}

export type AssetFileDownload = DirectAssetDownload | FetchedAssetDownload
