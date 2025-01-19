import type { MaybeRef } from 'vue'

import type { VueSeverity } from '../primeVueTypes'

interface MaintenanceTaskButton {
  readonly text?: string
  /** e.g. 'pi pi-external-link' */
  readonly icon?: string
}

export interface MaintenanceTask {
  /** ID string used as i18n key */
  readonly id: string
  /** Short name for status, e.g. Git */
  readonly name: string
  readonly description?: string
  readonly descriptionOk?: string
  readonly errorDescription?: string
  readonly detail?: string
  /** URL to the image to show in card mode. */
  readonly headerImg?: string
  readonly button?: MaintenanceTaskButton
  state?: 'warning' | 'error' | 'resolved' | 'OK' | 'skipped'
  /** `true` if the task has been resolved (was `error`, now `OK`). */
  resolved?: boolean
  loading?: MaybeRef<boolean>
  /** Whether to show a confirmation dialog before running the task. */
  readonly requireConfirm?: boolean
  readonly confirmText?: string
  /** Function to run when the button is clicked (or when confirmed, if required). */
  onClick?: (args?: unknown[]) => void | Promise<void>
  /** Called by onClick to run the actual task. */
  readonly execute: (args?: unknown[]) => boolean | Promise<boolean>
  /** Show the button with `severity="danger"` */
  readonly severity?: VueSeverity
  /** Whether this task should display the terminal window when run. */
  readonly usesTerminal?: boolean
  /** If `true`, successful completion of this task will refresh install validation and automatically continue if successful. */
  readonly isInstallationFix?: boolean
}

export interface MaintenanceFilter {
  readonly icon: string
  readonly value: string
  // value: 'All' | 'Errors'
  readonly tasks: MaintenanceTask[]
}
