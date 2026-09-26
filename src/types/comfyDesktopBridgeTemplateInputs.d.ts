import type { ComfyDownloadProgress } from '@comfyorg/comfyui-desktop-bridge-types'

declare module '@comfyorg/comfyui-desktop-bridge-types' {
  export interface ComfyTemplateInputReference {
    templateId: string
    assetId: string
  }

  export interface ComfyTemplateInputAssetDownload {
    downloadId: string
    filename: string
    progress: number
    receivedBytes?: number
    totalBytes?: number
    status: ComfyDownloadProgress['status']
    error?: string
  }

  export interface ComfyTemplateInputDownloadProgress extends ComfyTemplateInputAssetDownload {
    templateInputs: ComfyTemplateInputReference[]
  }

  export interface ComfyTemplateInputAsset {
    assetId: string
    filename: string
    mediaType: 'image' | 'video' | 'audio'
    previewUrl: string
    availability: 'present' | 'missing' | 'unknown'
    activeDownload?: ComfyTemplateInputAssetDownload
  }

  export type ComfyTemplateInputAssetDownloadResult =
    | { status: 'already-present' }
    | {
        status: 'accepted' | 'joined'
        download: ComfyTemplateInputAssetDownload
      }
    | {
        status: 'not-started'
        reason: 'invalid-request' | 'not-declared' | 'unavailable'
      }

  export interface ComfyDesktop2Bridge {
    getTemplateInputAssets?: (
      templateId: string
    ) => Promise<ComfyTemplateInputAsset[] | null>
    downloadTemplateInputAsset?: (
      templateId: string,
      assetId: string
    ) => Promise<ComfyTemplateInputAssetDownloadResult>
    onTemplateInputDownloadProgress?: (
      callback: (data: ComfyTemplateInputDownloadProgress) => void
    ) => () => void
  }
}
