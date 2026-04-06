export interface TemplateInfo {
  name: string
  title?: string
  description: string
  mediaType: 'image' | 'video' | 'audio' | '3d'
  mediaSubtype?: string
  thumbnailVariant?: 'compareSlider' | 'hoverDissolve' | 'zoomHover'
  thumbnail?: string[]
  tags?: string[]
  models?: string[]
  date?: string
  openSource?: boolean
  requiresCustomNodes?: string[]
  tutorialUrl?: string
  usage?: number
  username?: string
  size?: number
  vram?: number
  isApp?: boolean
}

export interface TemplateCategory {
  moduleName: string
  category: string
  icon: string
  title: string
  type: string
  templates: TemplateInfo[]
}

export interface RequiredNodeInfo {
  nodeType: string
  package: string
  url: string
  description?: string
}

export interface WorkflowModelRef {
  kind:
    | 'checkpoint'
    | 'unet'
    | 'vae'
    | 'clip'
    | 'lora'
    | 'controlnet'
    | 'upscaler'
    | 'other'
  filename: string
  nodeType: string
}

export interface SyncedTemplate extends TemplateInfo {
  extendedDescription: string
  howToUse: string[]
  metaDescription: string
  suggestedUseCases: string[]
  thumbnails: string[]
  detailImages?: string[]
  locale?: string
  estimatedTime?: string
  requiredNodes?: RequiredNodeInfo[]
  authorNotes?: string
  workflowModels?: WorkflowModelRef[]
}

export interface WorkflowNode {
  type: string
  [key: string]: unknown
}

export interface WorkflowJson {
  nodes?: WorkflowNode[]
  [key: string]: unknown
}
