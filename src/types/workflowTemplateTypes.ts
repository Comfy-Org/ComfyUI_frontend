export interface WorkflowTemplates {
  moduleName: string
  /** The title (display name) of the associated module */
  title: string
  /** The list of template workflow filenames for the associated module */
  templates: string[]
  /** The file type of the template workflow's outputs and thumbnail */
  type?: string
}
