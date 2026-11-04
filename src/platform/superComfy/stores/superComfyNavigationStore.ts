import { useSessionStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

export interface SuperComfyOrigin {
  workflowPath: string
  appNodeId: string
}

export const useSuperComfyNavigationStore = defineStore(
  'superComfyNavigation',
  () => {
    const isOpen = useSessionStorage('Comfy.SuperComfy.open', false, {
      flush: 'sync'
    })
    const origin = ref<SuperComfyOrigin | null>(null)
    const workflowStore = useWorkflowStore()
    const { flags } = useFeatureFlags()

    const isVisible = computed(() => isOpen.value && flags.superComfyEnabled)

    const parentCrumbVisible = computed(
      () =>
        !isOpen.value &&
        origin.value !== null &&
        origin.value.workflowPath === workflowStore.activeWorkflow?.path
    )

    function open() {
      isOpen.value = true
    }

    function close() {
      isOpen.value = false
    }

    function toggle() {
      isOpen.value = !isOpen.value
    }

    function markDrilledInto(next: SuperComfyOrigin) {
      origin.value = next
      isOpen.value = false
    }

    function returnToSuperComfy() {
      origin.value = null
      isOpen.value = true
    }

    return {
      isOpen,
      isVisible,
      origin,
      parentCrumbVisible,
      open,
      close,
      toggle,
      markDrilledInto,
      returnToSuperComfy
    }
  }
)
