import { useTitle } from '@vueuse/core'
import { computed } from 'vue'

import { useExecutionStore } from '@/stores/executionStore'
import { useSettingStore } from '@/stores/settingStore'
import { useWorkflowStore } from '@/stores/workflowStore'

const DEFAULT_TITLE = 'ComfyUI'
const TITLE_SUFFIX = ' - ComfyUI'

export const useBrowserTabTitle = () => {
  const executionStore = useExecutionStore()
  const settingStore = useSettingStore()
  const workflowStore = useWorkflowStore()

  const executionText = computed(() =>
    executionStore.isIdle
      ? ''
      : `[${Math.round(executionStore.executionProgress * 100)}%]`
  )

  const newMenuEnabled = computed(
    () => settingStore.get('Comfy.UseNewMenu') !== 'Disabled'
  )

  const isUnsavedText = computed(() =>
    workflowStore.activeWorkflow?.isModified ||
    !workflowStore.activeWorkflow?.isPersisted
      ? ' *'
      : ''
  )
  const workflowNameText = computed(() => {
    const workflowName = workflowStore.activeWorkflow?.filename
    return workflowName
      ? isUnsavedText.value + workflowName + TITLE_SUFFIX
      : DEFAULT_TITLE
  })

  const nodeExecutionTitle = computed(() =>
    executionStore.executingNode && executionStore.executingNodeProgress
      ? `${executionText.value}[${Math.round(executionStore.executingNodeProgress * 100)}%] ${executionStore.executingNode.type}`
      : ''
  )

  const workflowTitle = computed(
    () =>
      executionText.value +
      (newMenuEnabled.value ? workflowNameText.value : DEFAULT_TITLE)
  )

  const title = computed(() => nodeExecutionTitle.value || workflowTitle.value)
  useTitle(title)
}
