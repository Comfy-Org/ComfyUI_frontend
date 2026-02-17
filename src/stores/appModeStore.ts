import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type AppView = 'graph' | 'app'
export type BuilderStep = 'select' | 'arrange' | 'save'

export const useAppModeStore = defineStore('appMode', () => {
  const view = ref<AppView>('graph')
  const builderStep = ref<BuilderStep>('select')

  const isApp = computed(() => view.value === 'app')
  const isGraph = computed(() => view.value === 'graph')

  return { view, builderStep, isApp, isGraph }
})
