import type { InjectionKey, Ref } from 'vue'

export const FORM_FIELD_NAME_INJECTION_KEY: InjectionKey<Ref<string>> =
  Symbol('FORM_FIELD_NAME')

export const FORM_ITEM_ID_INJECTION_KEY: InjectionKey<string> =
  Symbol('FORM_ITEM_ID')
