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
}

export interface WorkflowTemplates {
  moduleName: string
  templates: TemplateInfo[]
  title: string
}

export interface TemplateGroup {
  label: string
  icon?: string
  modules: WorkflowTemplates[]
}
