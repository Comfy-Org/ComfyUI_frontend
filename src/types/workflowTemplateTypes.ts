export interface TemplateInfo {
  name: string
  tutorialUrl?: string
  mediaType: string
  mediaSubtype: string
  thumbnailVariant?: string
}

export interface WorkflowTemplates {
  moduleName: string
  templates: TemplateInfo[]
  title: string
}
export interface TemplateGroup {
  label: string
  modules: WorkflowTemplates[]
}
