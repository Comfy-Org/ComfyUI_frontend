import { inject, provide } from 'vue'
import type { InjectionKey } from 'vue'

import type { AutoTopUpReader } from '@comfyorg/account-core/billing'

export const AUTO_TOP_UP_SETTINGS_KEY: InjectionKey<AutoTopUpReader> =
  Symbol('autoTopUpSettings')

export function provideAutoTopUpSettings(reader: AutoTopUpReader) {
  provide(AUTO_TOP_UP_SETTINGS_KEY, reader)
}

/** The auto top-up settings reader the billing shell built for this scope. */
export function useAutoTopUpSettings(): AutoTopUpReader {
  const reader = inject(AUTO_TOP_UP_SETTINGS_KEY)
  if (reader === undefined) {
    throw new Error('No auto top-up settings: render inside the billing shell')
  }
  return reader
}
