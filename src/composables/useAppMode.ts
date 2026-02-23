import { computed, ref } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

export type AppMode = 'graph' | 'app' | 'builder:select' | 'builder:arrange'

const hasOutputs = ref(true)
const enableAppBuilder = ref(false)

export function useAppMode() {
  const mode = computed(() => {
    const wf = useWorkflowStore().activeWorkflow
    return wf?.activeMode ?? wf?.initialMode ?? 'graph'
  })

  const isBuilderMode = computed(
    () => mode.value === 'builder:select' || mode.value === 'builder:arrange'
  )
  const isAppMode = computed(
    () => mode.value === 'app' || mode.value === 'builder:arrange'
  )
  const isGraphMode = computed(
    () => mode.value === 'graph' || mode.value === 'builder:select'
  )

  function setMode(newMode: AppMode) {
    if (newMode === mode.value) return

    const workflow = useWorkflowStore().activeWorkflow
    if (workflow) workflow.activeMode = newMode
  }

  return {
    mode,
    enableAppBuilder,
    isBuilderMode,
    isAppMode,
    isGraphMode,
    hasOutputs,
    setMode
  }
}
