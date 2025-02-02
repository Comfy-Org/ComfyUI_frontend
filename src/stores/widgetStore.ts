import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { ComfyWidgetConstructor, ComfyWidgets } from '@/scripts/widgets'

import type { BaseInputSpec } from './nodeDefStore'

interface LazyWidgetState {
  values: Record<string, unknown[]>
  loading: Record<string, boolean>
  resolvers: Record<string, () => Promise<unknown[]>>
}

export const useWidgetStore = defineStore('widget', () => {
  const coreWidgets = ComfyWidgets
  const customWidgets = ref<Record<string, ComfyWidgetConstructor>>({})
  const widgets = computed(() => ({
    ...customWidgets.value,
    ...coreWidgets
  }))

  function getWidgetType(type: string, inputName: string) {
    if (type === 'COMBO') {
      return 'COMBO'
    } else if (type === 'FILE_COMBO') {
      return 'FILE_COMBO'
    } else if (`${type}:${inputName}` in widgets.value) {
      return `${type}:${inputName}`
    } else if (type in widgets.value) {
      return type
    } else {
      return null
    }
  }

  function inputIsWidget(spec: BaseInputSpec) {
    return getWidgetType(spec.type, spec.name) !== null
  }

  function registerCustomWidgets(
    newWidgets: Record<string, ComfyWidgetConstructor>
  ) {
    customWidgets.value = {
      ...customWidgets.value,
      ...newWidgets
    }
  }

  const lazyState = ref<LazyWidgetState>({
    values: {},
    loading: {},
    resolvers: {}
  })

  function registerResolver<T>(key: string, resolver: () => Promise<T[]>) {
    lazyState.value.resolvers[key] = resolver
  }

  function isLoading(key: string) {
    return lazyState.value.loading[key]
  }

  function isLazy(key: string) {
    return lazyState.value.resolvers[key] !== undefined
  }

  function getValues<T>(key: string) {
    const values = lazyState.value.values[key] as T[] | undefined
    if (!values && !isLoading(key) && isLazy(key)) {
      const resolver = lazyState.value.resolvers[key] as () => Promise<T[]>
      lazyState.value.loading[key] = true
      console.count(`[Lazy Widget] initialization count for ${key}`)
      resolver()
        .then((newValues) => {
          lazyState.value.values[key] = newValues
        })
        .catch((error) => {
          console.error(
            `[Lazy Widget] Error loading values for widget ${key}:`,
            error
          )
          // Backoff to prevent repeating failed requests
          setTimeout(() => {
            lazyState.value.loading[key] = false
          }, 2048)
          lazyState.value.values[key] = []
        })
        .finally(() => {
          lazyState.value.loading[key] = false
        })
    }
    return values || []
  }

  function clearCache(key: string) {
    delete lazyState.value.values[key]
  }

  return {
    widgets,
    getWidgetType,
    inputIsWidget,
    registerCustomWidgets,

    getValues,
    clearCache,
    registerResolver
  }
})
