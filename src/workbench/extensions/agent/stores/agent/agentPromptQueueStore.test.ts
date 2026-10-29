import { describe, expect, it, vi } from 'vitest'

import type { ComposerAttachment } from '@/workbench/extensions/agent/types/composerAttachment'

import { useAgentComposerStore } from './agentComposerStore'
import { useAgentPromptQueueStore } from './agentPromptQueueStore'

function attachment(id: string): ComposerAttachment {
  return { id, name: `${id}.png`, ref: id, previewUrl: `blob:${id}` }
}

function queueTwoWaiting(): ReturnType<typeof useAgentPromptQueueStore> {
  const composer = useAgentComposerStore()
  const queue = useAgentPromptQueueStore()
  composer.setText('first')
  queue.enqueueFromComposer('first', [], [])
  queue.begin(queue.items[0].id)
  composer.setText('second')
  queue.enqueueFromComposer('second', [], [])
  composer.clearDraft()
  return queue
}

describe('useAgentPromptQueueStore', () => {
  it('stashes the current draft when a waiting item is edited and restores it on cancel', () => {
    const composer = useAgentComposerStore()
    const queue = queueTwoWaiting()
    composer.setText('unsent draft')
    composer.addAttachment(attachment('draft'))

    expect(queue.startEdit(queue.items[1].id)).toBe(true)
    expect(queue.count).toBe(1)
    expect(composer.draft).toBe('second')
    expect(composer.attachments).toEqual([])

    expect(queue.cancelEdit()).toBe(true)
    expect(queue.items.map((item) => item.text)).toEqual(['first', 'second'])
    expect(composer.draft).toBe('unsent draft')
    expect(composer.attachments).toEqual([attachment('draft')])
  })

  it('appends the revised item and restores the stashed draft on submit', () => {
    const composer = useAgentComposerStore()
    const queue = queueTwoWaiting()
    composer.setText('unsent draft')

    const waitingId = queue.items[1].id
    expect(queue.startEdit(waitingId)).toBe(true)
    composer.setText('second revised')
    expect(queue.submitEdit('second revised', [], [])).toBe(true)

    expect(queue.items.map((item) => item.text)).toEqual([
      'first',
      'second revised'
    ])
    expect(queue.editingId).toBeNull()
    expect(composer.draft).toBe('unsent draft')
  })

  it('does not count the running item as a waiting follow-up', () => {
    const queue = useAgentPromptQueueStore()
    const composer = useAgentComposerStore()
    composer.setText('first')
    queue.enqueueFromComposer('first', [], [])
    queue.begin(queue.items[0].id)

    expect(queue.hasWaiting).toBe(false)
    expect(queue.count).toBe(1)

    composer.setText('second')
    queue.enqueueFromComposer('second', [], [])
    expect(queue.hasWaiting).toBe(true)
  })

  it('does not start edit on the active item and keeps the draft', () => {
    const composer = useAgentComposerStore()
    const queue = queueTwoWaiting()
    composer.setText('leave this')

    expect(queue.startEdit(queue.items[0].id)).toBe(false)
    expect(queue.editingId).toBeNull()
    expect(composer.draft).toBe('leave this')
    expect(queue.count).toBe(2)
  })

  it('keeps queued attachment previews when the composer draft is cleared', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const composer = useAgentComposerStore()
    const queue = useAgentPromptQueueStore()
    const queued = attachment('queued')
    composer.setText('with file')
    composer.addAttachment(queued)
    queue.enqueueFromComposer('with file', [queued], [])
    composer.clearDraft()

    expect(composer.draft).toBe('')
    expect(composer.attachments).toEqual([])
    expect(revoke).not.toHaveBeenCalled()
    expect(queue.startEdit(queue.items[0].id)).toBe(true)
    expect(composer.attachments).toEqual([queued])
    revoke.mockRestore()
  })
})
