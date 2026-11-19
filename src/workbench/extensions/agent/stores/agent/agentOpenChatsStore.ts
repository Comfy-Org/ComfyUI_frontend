import { defineStore } from 'pinia'
import { shallowReactive } from 'vue'

export const useAgentOpenChatsStore = defineStore('agentOpenChats', () => {
  const threadByWorkflow = shallowReactive(new Map<string, string>())
  const versionByWorkflow = new Map<string, number>()

  function versionFor(workflowId: string): number {
    return versionByWorkflow.get(workflowId) ?? 0
  }

  function bumpVersion(workflowId: string): void {
    versionByWorkflow.set(workflowId, versionFor(workflowId) + 1)
  }

  function remember(workflowId: string, threadId: string): void {
    if (threadByWorkflow.get(workflowId) === threadId) return
    forget(threadId)
    threadByWorkflow.set(workflowId, threadId)
    bumpVersion(workflowId)
  }

  function rememberIfCurrent(
    workflowId: string,
    threadId: string,
    expectedVersion: number
  ): boolean {
    if (versionFor(workflowId) !== expectedVersion) return false
    remember(workflowId, threadId)
    return true
  }

  function recall(workflowId: string): string | undefined {
    return threadByWorkflow.get(workflowId)
  }

  function forget(threadId: string): void {
    for (const [workflowId, remembered] of threadByWorkflow) {
      if (remembered !== threadId) continue
      threadByWorkflow.delete(workflowId)
      bumpVersion(workflowId)
    }
  }

  return { remember, rememberIfCurrent, versionFor, recall, forget }
})
