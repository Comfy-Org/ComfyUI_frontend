import { useTitle } from '@vueuse/core'
import { computed } from 'vue'

import { t } from '@/i18n'
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

  const nodeExecutionTitle = computed(() => {
    // Check if any nodes are in progress
    const nodeProgressEntries = Object.entries(
      executionStore.nodeProgressStates
    )
    const runningNodes = nodeProgressEntries.filter(
      ([_, state]) => state.state === 'running'
    )

    if (runningNodes.length === 0) {
      return ''
    }

    // If multiple nodes are running
    if (runningNodes.length > 1) {
      return `${executionText.value}[${runningNodes.length} ${t('g.nodesRunning', 'nodes running')}]`
    }

    // If only one node is running
    const [nodeId, state] = runningNodes[0]
    const progress = Math.round((state.value / state.max) * 100)
    const nodeType =
      executionStore.activePrompt?.workflow?.changeTracker?.activeState.nodes.find(
        (n) => String(n.id) === nodeId
      )?.type || 'Node'

    return `${executionText.value}[${progress}%] ${nodeType}`
  })

  const workflowTitle = computed(
    () =>
      executionText.value +
      (newMenuEnabled.value ? workflowNameText.value : DEFAULT_TITLE)
  )

  const title = computed(() => nodeExecutionTitle.value || workflowTitle.value)
  useTitle(title)
}
