import { watch } from 'vue'

import type { DocumentSource } from '@/platform/nodeApi/documents'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { createUuidv4 } from '@/utils/uuid'

/**
 * Describes the open workflows to the node API. Each time a workflow is
 * opened it gets a new session id, which it keeps until it is closed.
 */
export function useOpenDocuments(): () => DocumentSource[] {
  const store = useWorkflowStore()
  const sessions = new Map<string, string>()

  watch(
    () => store.openWorkflows.map(({ instanceId }) => instanceId),
    (open) => {
      for (const instanceId of sessions.keys()) {
        if (!open.includes(instanceId)) sessions.delete(instanceId)
      }
    },
    { flush: 'sync' }
  )

  return () =>
    store.openWorkflows.map((workflow) => {
      const sessionId = sessions.get(workflow.instanceId) ?? createUuidv4()
      sessions.set(workflow.instanceId, sessionId)
      return {
        sessionId,
        name: workflow.filename,
        path: workflow.path,
        isModified: workflow.isModified,
        isActive: store.activeWorkflow?.instanceId === workflow.instanceId
      }
    })
}
