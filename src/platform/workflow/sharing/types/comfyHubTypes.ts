export type ThumbnailType = 'image' | 'video' | 'imageComparison'

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
  thumbnailUrl: string | null
  comparisonBeforeFile: File | null
  comparisonBeforeUrl: string | null
  comparisonAfterFile: File | null
  comparisonAfterUrl: string | null
  exampleImages: ExampleImage[]
  tutorialUrl: string
  metadata: Record<string, unknown>
}
