import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'

export const WORKSPACE_TEMPLATES_NAV_ID = 'workspace'
export const WORKSPACE_TEMPLATE_SOURCE = 'workspace'

export type WorkspaceTemplateThumbnailType =
  | 'image'
  | 'video'
  | 'image_comparison'

export interface WorkspaceTemplateRequirements {
  models: { name: string; directory: string }[]
  custom_nodes: { package: string; node_types: string[] }[]
  uses_partner_nodes: boolean
  is_app: boolean
}

/** One template as `GET /api/workspace/templates` returns it. */
export interface WorkspaceTemplateResponse {
  id: string
  title: string
  description: string
  created_by: { id: string; name: string }
  created_at: string
  updated_at: string
  thumbnail_url: string
  thumbnail_type: WorkspaceTemplateThumbnailType
  comparison_url: string | null
  requirements: WorkspaceTemplateRequirements
  viewer_can_edit: boolean
  viewer_can_delete: boolean
}

export interface WorkspaceTemplatePermissionsResponse {
  'workspace_templates:view': boolean
  'workspace_templates:create': boolean
}

export interface WorkspaceTemplateThumbnailInput {
  type: WorkspaceTemplateThumbnailType
  url: string
  comparisonUrl: string | null
}

export interface CreateWorkspaceTemplateRequest {
  title: string
  description: string
  workflow_json: ComfyWorkflowJSON
  thumbnail: WorkspaceTemplateThumbnailInput
  requirements: WorkspaceTemplateRequirements
}

export interface UpdateWorkspaceTemplateRequest {
  title?: string
  description?: string
}

export interface WorkspaceTemplatesApi {
  getPermissions(): Promise<WorkspaceTemplatePermissionsResponse>
  list(): Promise<WorkspaceTemplateResponse[]>
  getWorkflow(id: string): Promise<ComfyWorkflowJSON | null>
  create(
    body: CreateWorkspaceTemplateRequest
  ): Promise<WorkspaceTemplateResponse>
  update(
    id: string,
    body: UpdateWorkspaceTemplateRequest
  ): Promise<WorkspaceTemplateResponse>
  remove(id: string): Promise<void>
}
