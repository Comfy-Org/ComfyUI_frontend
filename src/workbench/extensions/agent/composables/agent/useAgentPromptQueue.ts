import { reportError } from '@comfyorg/telemetry/reportError'
import { watch } from 'vue'

import { useAgentPromptQueueStore } from '@/workbench/extensions/agent/stores/agent/agentPromptQueueStore'
import type { PromptQueueItem } from '@/workbench/extensions/agent/stores/agent/promptQueueState'
import type { ComposerAttachment } from '@/workbench/extensions/agent/types/composerAttachment'
import type { WorkflowReference } from '@/workbench/extensions/agent/types/workflowReference'

type QueueSendResult =
  | void
  | boolean
  | 'deferred'
  | Promise<void | boolean | 'deferred'>

export function useAgentPromptQueue(options: {
  isBusy: () => boolean
  submitDraft: (
    text: string,
    attachments: ComposerAttachment[],
    references?: WorkflowReference[]
  ) => QueueSendResult
  sendItem: (item: PromptQueueItem) => QueueSendResult
  deferCapture: () => void
}) {
  const queue = useAgentPromptQueueStore()
  let pumping = false
  let pumpingId: string | null = null
  let pumpRequested = false

  async function settleStartedSend(
    id: string,
    submitted: QueueSendResult
  ): Promise<string | null> {
    let sent: void | boolean | 'deferred'
    try {
      sent = await submitted
    } catch (error) {
      queue.finish(id)
      reportError(error, {
        surface: 'agent',
        errorType: 'agent_send_message_failed'
      })
      return null
    }
    if (sent === 'deferred') {
      queue.release(id)
      return id
    }
    if (sent === false) {
      const wasActive = queue.runningId === id
      queue.finish(id)
      if (wasActive && options.isBusy()) queue.clearComposerDraft()
    }
    return null
  }

  function currentNextItem(): PromptQueueItem | undefined {
    return queue.nextItem
  }

  async function pump(): Promise<void> {
    if (pumping) {
      pumpRequested = true
      return
    }
    if (options.isBusy() || queue.runningId) return
    const next = currentNextItem()
    if (!next) return
    pumping = true
    pumpingId = next.id
    queue.begin(next.id)
    let deferredId: string | null = null
    try {
      deferredId = await settleStartedSend(next.id, options.sendItem(next))
    } finally {
      pumpingId = null
      pumping = false
    }
    if (pumpRequested) {
      pumpRequested = false
      if (deferredId === null) await settleActiveAndPump()
      else if (currentNextItem()?.id !== deferredId) await pump()
    }
  }

  async function settleActiveAndPump(): Promise<void> {
    if (options.isBusy()) return
    if (queue.runningId && queue.runningId !== pumpingId)
      queue.finish(queue.runningId)
    await pump()
  }

  watch(
    () => queue.editingId,
    (editingId, previous) => {
      if (previous !== null && editingId === null) void pump()
    }
  )

  function handleComposerSend(
    text: string,
    attachments: ComposerAttachment[],
    references: WorkflowReference[] = []
  ): void {
    if (queue.editingId) {
      queue.submitEdit(text, attachments, references)
      void pump()
      return
    }
    const item = queue.enqueueFromComposer(text, attachments, references)
    if (
      !options.isBusy() &&
      !queue.runningId &&
      queue.nextItem?.id === item.id
    ) {
      queue.begin(item.id)
      void settleStartedSend(
        item.id,
        options.submitDraft(text, attachments, references)
      )
      return
    }
    queue.clearComposerDraft()
    options.deferCapture()
    void pump()
  }

  return { handleComposerSend, settleActiveAndPump }
}
