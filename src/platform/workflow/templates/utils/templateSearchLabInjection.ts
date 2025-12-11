import type { InjectionKey, Ref } from 'vue'

export const TEMPLATE_SEARCH_QUERY_OVERRIDE_KEY: InjectionKey<Ref<string>> =
  Symbol('TemplateSearchOverride')
