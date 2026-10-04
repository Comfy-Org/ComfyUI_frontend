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
  name: string
  description: string
  status?: TemplateDetailRowStatus
}

/**
 * What the Detail footer may offer. `resolving` is distinct from `none`:
 * availability is not known yet, so it cannot yet be said that nothing is
 * downloadable.
 */
export type TemplateModelSetupState = 'none' | 'resolving' | 'downloadable'

export interface TemplateDetailGroup {
  id: string
  label: string
  total?: string
  rows: readonly TemplateDetailRow[]
}
