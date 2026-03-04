export type ThumbnailType = 'image' | 'video' | 'imageComparison'

export type ComfyHubWorkflowType =
  | 'imageGeneration'
  | 'videoGeneration'
  | 'upscaling'
  | 'editing'

export interface ExampleImage {
  id: string
  url: string
  file?: File
}

export interface ComfyHubPublishFormData {
  name: string
  description: string
  workflowType: ComfyHubWorkflowType | ''
  tags: string[]
  thumbnailType: ThumbnailType
  thumbnailFile: File | null
  comparisonBeforeFile: File | null
  comparisonAfterFile: File | null
  exampleImages: ExampleImage[]
  selectedExampleIds: string[]
}
