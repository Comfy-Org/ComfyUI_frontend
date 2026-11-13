import { defineStore } from 'pinia'
import { shallowReactive } from 'vue'

export const useAgentOpenChatsStore = defineStore('agentOpenChats', () => {
  const threadByWorkflow = shallowReactive(new Map<string, string>())

  function remember(workflowId: string, threadId: string): void {
    forget(threadId)
    threadByWorkflow.set(workflowId, threadId)
  }

  function recall(workflowId: string): string | undefined {
    return threadByWorkflow.get(workflowId)
  }

  function forget(threadId: string): void {
    for (const [workflowId, remembered] of threadByWorkflow)
      if (remembered === threadId) threadByWorkflow.delete(workflowId)
  }

  return { remember, recall, forget }
})
