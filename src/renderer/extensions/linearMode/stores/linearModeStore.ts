import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type {
  LinearModeTemplate,
  OutputImage,
  PromotedWidget
} from '../linearModeTypes'
import { getTemplateConfig } from '../linearModeConfig'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useQueueStore } from '@/stores/queueStore'
import type { TaskItemImpl } from '@/stores/queueStore'

export const useLinearModeStore = defineStore('linearMode', () => {
  const isOpen = ref(false)

  const templateId = ref<string | null>(null)

  const currentOutput = ref<OutputImage | null>(null)

  const generatedPromptIds = ref<Set<string>>(new Set())

  const template = computed<LinearModeTemplate | null>(() => {
    if (!templateId.value) return null
    return getTemplateConfig(templateId.value)
  })

  const promotedWidgets = computed<PromotedWidget[]>(() => {
    return template.value?.promotedWidgets ?? []
  })

  const currentWorkflow = computed<ComfyWorkflowJSON | null>(() => {
    const workflowStore = useWorkflowStore()
    return workflowStore.activeWorkflow?.activeState ?? null
  })

  const filteredHistory = computed(() => {
    const queueStore = useQueueStore()
    return queueStore.historyTasks.filter((item: TaskItemImpl) =>
      generatedPromptIds.value.has(item.promptId)
    )
  })

  const isGenerating = computed(() => {
    const queueStore = useQueueStore()
    return queueStore.pendingTasks.some((item: TaskItemImpl) =>
      generatedPromptIds.value.has(item.promptId)
    )
  })

  function open(templateIdParam: string): void {
    if (!getTemplateConfig(templateIdParam)) {
      throw new Error(`Invalid template ID: ${templateIdParam}`)
    }

    isOpen.value = true
    templateId.value = templateIdParam
  }

  function close(): void {
    isOpen.value = false
  }

  function setOutput(output: OutputImage | null): void {
    currentOutput.value = output
  }

  function trackGeneratedPrompt(promptId: string): void {
    generatedPromptIds.value.add(promptId)
  }

  function reset(): void {
    isOpen.value = false
    templateId.value = null
    currentOutput.value = null
    generatedPromptIds.value.clear()
  }

  return {
    // State
    isOpen,
    templateId,
    currentOutput,
    generatedPromptIds,

    // Getters
    template,
    promotedWidgets,
    currentWorkflow,
    filteredHistory,
    isGenerating,

    // Actions
    open,
    close,
    setOutput,
    trackGeneratedPrompt,
    reset
  }
})
