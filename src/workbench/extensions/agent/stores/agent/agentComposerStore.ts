import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { ComposerAttachment } from '../../composables/agent/useComposer'
import type { WorkflowReference } from '../../types/workflowReference'

export const useAgentComposerStore = defineStore('agentComposer', () => {
  const draft = ref('')
  const attachments = ref<ComposerAttachment[]>([])
  const workflowReferences = ref<WorkflowReference[]>([])

  return { draft, attachments, workflowReferences }
})
