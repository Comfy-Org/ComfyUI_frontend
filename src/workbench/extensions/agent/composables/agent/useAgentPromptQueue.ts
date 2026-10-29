import { useAgentPromptQueueStore } from '@/workbench/extensions/agent/stores/agent/agentPromptQueueStore'
import type { PromptQueueItem } from '@/workbench/extensions/agent/stores/agent/promptQueueState'
import type { ComposerAttachment } from '@/workbench/extensions/agent/types/composerAttachment'
import type { WorkflowReference } from '@/workbench/extensions/agent/types/workflowReference'

type QueueSendResult = void | boolean | Promise<void | boolean>

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

  async function settleStartedSend(
    id: string,
    submitted: QueueSendResult
  ): Promise<void> {
    const sent = await submitted
    if (sent === false && queue.runningId === id) {
      queue.finish(id)
      if (options.isBusy()) queue.clearComposerDraft()
    }
  }

  async function pump(): Promise<void> {
    if (pumping || options.isBusy() || queue.runningId) return
    const next = queue.nextItem
    if (!next) return
    pumping = true
    queue.begin(next.id)
    try {
      await settleStartedSend(next.id, options.sendItem(next))
    } finally {
      pumping = false
    }
  }

  async function settleActiveAndPump(): Promise<void> {
    if (options.isBusy()) return
    if (queue.runningId) queue.finish(queue.runningId)
    await pump()
  }

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
