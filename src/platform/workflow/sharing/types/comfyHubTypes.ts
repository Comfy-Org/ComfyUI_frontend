export type ThumbnailType = 'image' | 'video' | 'imageComparison'

export type ComfyHubApiThumbnailType = 'image' | 'video' | 'image_comparison'

export interface ExampleImage {
  id: string
  url: string
  file?: File
}

export interface ComfyHubPublishFormData {
  name: string
  description: string
  tags: string[]
  models: string[]
  customNodes: string[]
  thumbnailType: ThumbnailType
  thumbnailFile: File | null
  comparisonBeforeFile: File | null
  comparisonAfterFile: File | null
  exampleImages: ExampleImage[]
  tutorialUrl: string
  metadata: Record<string, unknown>
}
