import type { ComputedRef, InjectionKey } from 'vue'

export interface ImportFailedContext {
  importFailed: ComputedRef<boolean>
  showImportFailedDialog: () => void
}

export const ImportFailedKey: InjectionKey<ImportFailedContext> =
  Symbol('ImportFailed')
