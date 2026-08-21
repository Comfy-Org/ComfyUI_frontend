import type { TemplateModelDownloadState } from '@/platform/workflow/templates/utils/templateModelDownloadState'

export type TemplateDetailRowStatus =
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

interface TemplateDetailRow {
  id: string
  name: string
  description: string
  status?: TemplateDetailRowStatus
}

export interface TemplateDetailGroup {
  id: string
  label: string
  total?: string
  rows: readonly TemplateDetailRow[]
}
