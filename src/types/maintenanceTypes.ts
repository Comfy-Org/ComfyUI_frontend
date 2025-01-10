import type { MaybeRef } from 'vue'

import type { VueSeverity } from './vueTypes'

interface MaintenanceTaskButton {
  text?: string
  /** e.g. 'pi pi-external-link' */
  icon?: string
}

export interface MaintenanceTask {
  /** ID string used as i18n key */
  id: string
  /** Short name for status, e.g. Git */
  name: string
  description?: string
  descriptionOk?: string
  errorDescription?: string
  /** URL to the image to show in card mode. */
  headerImg?: string
  button?: MaintenanceTaskButton
  state: 'warning' | 'error' | 'resolved' | 'OK' | 'skipped' | null
  /** `true` if the task has been resolved (was `error`, now `OK`). */
  resolved?: boolean
  loading?: MaybeRef<boolean>
  /** Whether to show a confirmation dialog before running the task. */
  requireConfirm?: boolean
  confirmText?: string
  /** Function to run when the button is clicked (or when confirmed, if required). */
  onClick: (args?: unknown[]) => unknown | Promise<unknown>
  /** Show the button with `severity="danger"` */
  severity?: VueSeverity
}

export interface MaintenanceFilter {
  icon: string
  value: string
  // value: 'All' | 'Errors'
  tasks: MaintenanceTask[]
}
