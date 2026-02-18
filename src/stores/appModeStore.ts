import { defineStore } from 'pinia'
import { readonly, computed, ref } from 'vue'

export type AppMode = 'graph' | 'app' | 'builder:select' | 'builder:arrange'

export const useAppModeStore = defineStore('appMode', () => {
  const mode = ref<AppMode>('graph')
  const builderSaving = ref(false)
  const hasOutputs = ref(true)

  const isBuilderMode = computed(
    () => mode.value === 'builder:select' || mode.value === 'builder:arrange'
  )
  const isAppMode = computed(
    () => mode.value === 'app' || mode.value === 'builder:arrange'
  )
  const isGraphMode = computed(
    () => mode.value === 'graph' || mode.value === 'builder:select'
  )
  const isBuilderSaving = computed(
    () => builderSaving.value && isBuilderMode.value
  )

  return {
    mode: readonly(mode),
    isBuilderMode,
    isAppMode,
    isGraphMode,
    isBuilderSaving,
    hasOutputs,
    setBuilderSaving: (newBuilderSaving: boolean) => {
      if (!isBuilderMode.value) return
      builderSaving.value = newBuilderSaving
    },
    setMode: (newMode: AppMode) => {
      if (newMode === mode.value) return
      mode.value = newMode
    }
  }
})
