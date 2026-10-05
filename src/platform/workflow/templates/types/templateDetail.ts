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
 * What the Detail footer should offer, shaped like the footer rather than like
 * the parent's data. Absent means there is nothing to offer - setup is off,
 * every requirement is met, or nothing is startable - and all three render the
 * same single Open now. `remainingSize` lives only in the arm where it can
 * exist, so "startable but size unknown" is representable and "resolving with a
 * size" is not.
 */
export type TemplateModelSetup =
  | { state: 'resolving' }
  | { state: 'startable'; remainingSize?: string }

export interface TemplateDetailGroup {
  id: string
  label: string
  total?: string
  rows: readonly TemplateDetailRow[]
}
