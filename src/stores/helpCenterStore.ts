import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

export type HelpCenterTriggerLocation = 'sidebar' | 'topbar'

export const useHelpCenterStore = defineStore('helpCenter', () => {
  const isVisible = ref(false)
  const triggerLocation = ref<HelpCenterTriggerLocation>('sidebar')
  const triggerElement = shallowRef<HTMLElement | null>(null)

  const toggle = (
    location: HelpCenterTriggerLocation = 'sidebar',
    element?: HTMLElement | null
  ) => {
    if (!isVisible.value) {
      triggerLocation.value = location
      triggerElement.value = element ?? null
    }
    isVisible.value = !isVisible.value
  }

  const show = (
    location: HelpCenterTriggerLocation = 'sidebar',
    element?: HTMLElement | null
  ) => {
    triggerLocation.value = location
    triggerElement.value = element ?? null
    isVisible.value = true
  }

  const hide = () => {
    isVisible.value = false
  }

  return {
    isVisible,
    triggerLocation,
    triggerElement,
    toggle,
    show,
    hide
  }
})
