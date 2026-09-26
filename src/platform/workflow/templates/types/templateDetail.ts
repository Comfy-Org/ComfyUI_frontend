import type { TemplateModelDownloadState } from '@/platform/workflow/templates/utils/templateModelDownloadState'

type TemplateDetailRowStatus =
  | {
      kind: 'installed'
      label: string
    }
  | {
      kind: 'downloadable'
      label: string
      downloadState?: TemplateModelDownloadState
    }
  | {
      kind: 'manual'
      label: string
      href: string
    }
  | {
      kind: 'unavailable' | 'unknown'
      label: string
    }

export interface TemplateDetailRow {
  id: string
  kind?: 'model' | 'input'
  name: string
  description: string
  preview?: {
    src: string
    mediaType: 'image' | 'video' | 'audio'
  }
  status?: TemplateDetailRowStatus
}

export interface TemplateDetailGroup {
  id: string
  label: string
  total?: string
  rows: readonly TemplateDetailRow[]
}
