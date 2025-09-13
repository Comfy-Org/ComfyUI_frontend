import type { ComputedRef } from 'vue'
import { InjectionKey } from 'vue'

interface ImportFailedContext {
  importFailed: ComputedRef<boolean>
  showImportFailedDialog: () => void
}

export const ImportFailedKey: InjectionKey<ImportFailedContext> =
  Symbol('ImportFailed')
