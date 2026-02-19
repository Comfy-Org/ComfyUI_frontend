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
  thumbnailType: ThumbnailType
  thumbnailFile: File | null
  exampleImages: ExampleImage[]
  selectedExampleIds: string[]
}
