import type { PrimeVueSeverity } from '../primeVueTypes'

interface MaintenanceTaskButton {
  text?: string
  /** CSS classes, e.g. 'pi pi-external-link' */
  icon?: string
}

export interface MaintenanceTask {
  /** Used as i18n key */
  id: string
  name: string
  shortDescription?: string
  errorDescription?: string
  warningDescription?: string
  description?: string
  headerImg?: string
  button?: MaintenanceTaskButton
  requireConfirm?: boolean
  confirmText?: string
  execute: (args?: unknown[]) => boolean | Promise<boolean>
  severity?: PrimeVueSeverity
  usesTerminal?: boolean
  /** If true, successful completion refreshes install validation and auto-continues. */
  isInstallationFix?: boolean
}

export interface MaintenanceFilter {
  /** CSS classes, e.g. 'pi pi-cross' */
  icon: string
  value: string
  tasks: ReadonlyArray<MaintenanceTask>
}
