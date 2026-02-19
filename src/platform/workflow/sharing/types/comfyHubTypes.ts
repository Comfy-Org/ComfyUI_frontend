export type ThumbnailType = 'image' | 'video' | 'imageComparison'

export interface ComfyHubPublishFormData {
  name: string
  description: string
  tags: string[]
  thumbnailType: ThumbnailType
  thumbnailFile: File | null
}
