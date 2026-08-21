import type { TemplateModelDownloadState } from '@/platform/workflow/templates/utils/templateModelDownloadState'

interface TemplateDetailLink {
  label: string
  href: string
}

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
      kind: 'installable'
      label: string
    }
  | {
      kind: 'manual'
      label: string
      href: string
    }
  | {
      kind: 'disabled' | 'in-progress' | 'unavailable' | 'unknown'
      label: string
      action?: TemplateDetailLink
    }

export interface TemplateDetailRow {
  id: string
  kind: 'model' | 'custom-node'
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
