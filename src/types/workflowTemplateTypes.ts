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
  sourceModule?: string
  tags?: string[]
  models?: string[]
  date?: string
}

export interface WorkflowTemplates {
  moduleName: string
  templates: TemplateInfo[]
  title: string
  localizedTitle?: string
}

export interface TemplateSubcategory {
  label: string
  modules: WorkflowTemplates[]
}

export interface TemplateGroup {
  label: string
  icon?: string
  subcategories: TemplateSubcategory[]
}
