export interface TemplateInfo {
  name: string
  /**
   * Optional title which is used as the fallback if the name is not in the locales dictionary.
   */
  title?: string
  tutorialUrl?: string
  mediaType: string
  mediaSubtype: string
  thumbnailVariant?: string
  description: string
  localizedTitle?: string
  localizedDescription?: string
  isEssential?: boolean
  sourceModule?: string
  tags?: string[]
  models?: string[]
  date?: string
  useCase?: string
  license?: string
  /**
   * Estimated VRAM requirement in bytes.
   */
  vram?: number
  size?: number
}

export interface WorkflowTemplates {
  moduleName: string
  templates: TemplateInfo[]
  title: string
  localizedTitle?: string
  category?: string
  type?: string
  icon?: string
  isEssential?: boolean
}

export interface TemplateGroup {
  label: string
  icon?: string
  modules: WorkflowTemplates[]
}
