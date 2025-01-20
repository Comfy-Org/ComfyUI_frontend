import type { MaybeRef } from 'vue'

import type { VueSeverity } from '../primeVueTypes'

interface MaintenanceTaskButton {
  /** The text to display on the button. */
  readonly text?: string
  /** CSS classes used for the button icon, e.g. 'pi pi-external-link' */
  readonly icon?: string
}

export interface MaintenanceTask {
  /** ID string used as i18n key */
  readonly id: string
  /** The display name of the task, e.g. Git */
  readonly name: string
  /** Short description of the task. */
  readonly shortDescription?: string
  /** Description of the task when it is in an error state. */
  readonly errorDescription?: string
  /** Description of the task when it is in a warning state. */
  readonly warningDescription?: string
  /** Full description of the task when it is in an OK state. */
  readonly description?: string
  /** URL to the image to show in card mode. */
  readonly headerImg?: string
  /** The button to display on the task card / list item. */
  readonly button?: MaintenanceTaskButton
  /** The current state of the task. */
  state?: 'warning' | 'error' | 'resolved' | 'OK' | 'skipped'
  /** `true` if the task has been resolved (was `error`, now `OK`). */
  resolved?: boolean
  /** Whether the task is currently running. */
  loading?: MaybeRef<boolean>
  /** Whether to show a confirmation dialog before running the task. */
  readonly requireConfirm?: boolean
  /** The text to display in the confirmation dialog. */
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
  /** CSS classes used for the filter button icon, e.g. 'pi pi-cross' */
  readonly icon: string
  /** The text to display on the filter button. */
  readonly value: string
  /** The tasks to display when this filter is selected. */
  readonly tasks: MaintenanceTask[]
}
