import type { MaybeRef } from 'vue'

import type { VueSeverity } from '../primeVueTypes'

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
  detail?: string
  /** URL to the image to show in card mode. */
  headerImg?: string
  button?: MaintenanceTaskButton
  state?: 'warning' | 'error' | 'resolved' | 'OK' | 'skipped'
  /** `true` if the task has been resolved (was `error`, now `OK`). */
  resolved?: boolean
  loading?: MaybeRef<boolean>
  /** Whether to show a confirmation dialog before running the task. */
  requireConfirm?: boolean
  confirmText?: string
  /** Function to run when the button is clicked (or when confirmed, if required). */
  onClick?: (args?: unknown[]) => void | Promise<void>
  /** Called by onClick to run the actual task. */
  execute: (args?: unknown[]) => boolean | Promise<boolean>
  /** Show the button with `severity="danger"` */
  severity?: VueSeverity
  /** Whether this task should display the terminal window when run. */
  usesTerminal?: boolean
  /** If `true`, successful completion of this task will refresh install validation and automatically continue if successful. */
  isInstallationFix?: boolean
}

export interface MaintenanceFilter {
  icon: string
  value: string
  // value: 'All' | 'Errors'
  tasks: MaintenanceTask[]
}
