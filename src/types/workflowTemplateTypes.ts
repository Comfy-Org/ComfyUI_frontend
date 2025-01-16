export interface WorkflowTemplates {
  /** The unique identifier for the associated module that the template originates from*/
  moduleName: string
  /** The title (display name) of the associated module */
  title: string
  /** The list of template workflow filenames for the associated module */
  templates: string[]
  /** The content type of the template workflow's outputs and thumbnail */
  type?: string
}
