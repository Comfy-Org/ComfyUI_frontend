import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type AppView = 'graph' | 'app'
export type BuilderStep = 'select' | 'arrange'

export const useAppModeStore = defineStore('appMode', () => {
  const view = ref<AppView>('graph')
  const builderStep = ref<BuilderStep>('select')
  const builderMode = ref(false)
  const builderSaving = ref(false)
  const hasOutputs = ref(false)

  const isApp = computed(() => view.value === 'app')
  const isGraph = computed(() => view.value === 'graph')

  return {
    view,
    builderStep,
    builderMode,
    builderSaving,
    hasOutputs,
    isApp,
    isGraph
  }
})
