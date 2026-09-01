import { computed, ref } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

export type AppMode =
  | 'graph'
  | 'app'
  | 'builder:inputs'
  | 'builder:outputs'
  | 'builder:arrange'

const enableAppBuilder = ref(true)

export function useAppMode() {
  const workflowStore = useWorkflowStore()
  const mode = computed(
    () =>
      workflowStore.activeWorkflow?.activeMode ??
      workflowStore.activeWorkflow?.initialMode ??
      'graph'
  )

  const isBuilderMode = computed(
    () => isSelectMode.value || isArrangeMode.value
  )
  const isSelectInputsMode = computed(() => mode.value === 'builder:inputs')
  const isSelectOutputsMode = computed(() => mode.value === 'builder:outputs')
  const isSelectMode = computed(
    () => isSelectInputsMode.value || isSelectOutputsMode.value
  )
  const isArrangeMode = computed(() => mode.value === 'builder:arrange')
  const isAppMode = computed(
    () => mode.value === 'app' || mode.value === 'builder:arrange'
  )
  const isGraphMode = computed(
    () => mode.value === 'graph' || isSelectMode.value
  )

  function setMode(newMode: AppMode) {
    const workflow = workflowStore.activeWorkflow
    if (workflow) workflow.activeMode = newMode
  }

  return {
    mode,
    enableAppBuilder,
    isBuilderMode,
    isSelectMode,
    isSelectInputsMode,
    isSelectOutputsMode,
    isArrangeMode,
    isAppMode,
    isGraphMode,
    setMode
  }
}
