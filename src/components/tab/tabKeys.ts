import type { InjectionKey, Ref } from 'vue'

interface TabListContext {
  modelValue: Ref<string>
  select: (value: string) => void
}

export const TAB_LIST_INJECTION_KEY: InjectionKey<TabListContext> =
  Symbol('TabListContext')
