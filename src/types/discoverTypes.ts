/**
 * Workflow template record from the Algolia workflow_templates index.
 */
export interface AlgoliaWorkflowTemplate {
  objectID: string
  name: string
  title: string
  description: string
  thumbnail_url: string
  thumbnail_urls: string[]
  thumbnail_count: number
  thumbnail_variant: '' | 'compareSlider' | 'hoverDissolve' | 'hoverZoom'
  media_type: 'image' | 'video' | 'audio' | '3d'
  media_subtype: string
  tags: string[]
  models: string[]
  open_source: boolean
  requires_custom_nodes: string[]
}

export type WorkflowTemplateSearchAttribute = keyof AlgoliaWorkflowTemplate

export interface WorkflowTemplateSearchParams {
  query: string
  pageSize: number
  pageNumber: number
  filters?: string
  facetFilters?: string[][]
}

export interface WorkflowTemplateSearchResult {
  templates: AlgoliaWorkflowTemplate[]
  totalHits: number
  totalPages: number
  page: number
  facets?: Record<string, Record<string, number>>
}
