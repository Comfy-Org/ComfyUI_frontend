import { describe, expect, it, vi } from 'vitest'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import type { ComposerAttachment } from '@/workbench/extensions/agent/types/composerAttachment'

import { useAgentComposerStore } from './agentComposerStore'
import { useAgentPanelStore } from './agentPanelStore'
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

  it('keeps a queued attachment preview when it is removed during an edit and the edit is cancelled', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const composer = useAgentComposerStore()
    const queue = useAgentPromptQueueStore()
    const queued = attachment('queued')
    composer.setText('with file')
    composer.addAttachment(queued)
    queue.enqueueFromComposer('with file', [queued], [])
    composer.clearDraft()

    expect(queue.startEdit(queue.items[0].id)).toBe(true)
    composer.removeAttachment('queued')
    expect(composer.attachments).toEqual([])
    queue.cancelEdit()

    expect(revoke).not.toHaveBeenCalled()
    expect(queue.startEdit(queue.items[0].id)).toBe(true)
    expect(composer.attachments).toEqual([queued])
    revoke.mockRestore()
  })

  it('records the workflow target each prompt was queued for', () => {
    const target = { path: 'workflows/a.json' } as ComfyWorkflow
    vi.spyOn(useAgentPanelStore(), 'selectedWorkflow', 'get').mockReturnValue(
      target
    )
    const queue = useAgentPromptQueueStore()
    useAgentComposerStore().setText('first')
    queue.enqueueFromComposer('first', [], [])

    expect(queue.items[0].target).toEqual(target)
  })

  it('isolates queued items per chat key, keeps stashed attachments alive, and restores edits before switching', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const composer = useAgentComposerStore()
    const queue = useAgentPromptQueueStore()
    const queuedFile = attachment('tab-a-file')

    queue.activateQueue('thread:a')
    composer.activateDraft('thread:a')
    composer.setText('running on A')
    queue.enqueueFromComposer('running on A', [], [])
    queue.begin(queue.items[0].id)
    composer.setText('follow-up on A')
    composer.addAttachment(queuedFile)
    queue.enqueueFromComposer('follow-up on A', [queuedFile], [])
    composer.clearDraft()
    composer.setText('unsent draft on A')
    expect(queue.startEdit(queue.items[1].id)).toBe(true)
    expect(composer.draft).toBe('follow-up on A')

    queue.activateQueue('blank:b')
    composer.activateDraft('blank:b')
    expect(queue.items).toEqual([])
    expect(queue.hasWaiting).toBe(false)
    expect(composer.draft).toBe('')
    expect(revoke).not.toHaveBeenCalled()

    queue.activateQueue('thread:a')
    composer.activateDraft('thread:a')
    expect(queue.items.map((item) => item.text)).toEqual([
      'running on A',
      'follow-up on A'
    ])
    expect(queue.editingId).toBeNull()
    expect(composer.draft).toBe('unsent draft on A')
    revoke.mockRestore()
  })

  it('rekeys a blank chat queue to its created thread and finishes stashed running items cleanly', () => {
    const composer = useAgentComposerStore()
    const queue = useAgentPromptQueueStore()

    queue.activateQueue('blank:a')
    composer.setText('first')
    const first = queue.enqueueFromComposer('first', [], [])
    queue.begin(first.id)
    composer.setText('second')
    queue.enqueueFromComposer('second', [], [])
    composer.clearDraft()

    queue.activateQueue('blank:b')
    queue.rekeyQueue('blank:a', 'thread:a')
    queue.finish(first.id)

    queue.activateQueue('thread:a')
    expect(queue.runningId).toBeNull()
    expect(queue.items.map((item) => item.text)).toEqual(['second'])

    queue.discardQueue('thread:a')
    expect(queue.items).toEqual([])
  })

  it('preserves the oldest kept queue when activating it at the 64-queue cap', () => {
    const composer = useAgentComposerStore()
    const queue = useAgentPromptQueueStore()

    for (let index = 0; index <= 64; index += 1) {
      queue.activateQueue(`chat:${index}`)
      composer.setText(`prompt-${index}`)
      queue.enqueueFromComposer(`prompt-${index}`, [], [])
      composer.clearDraft()
    }

    queue.activateQueue('chat:0')
    expect(queue.items.map((item) => item.text)).toEqual(['prompt-0'])
  })

  it('releases unused blob attachment previews when discarding an inactive kept queue', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const composer = useAgentComposerStore()
    const queue = useAgentPromptQueueStore()
    const file = {
      id: 'queued-blob-1',
      name: 'cat.png',
      ref: 'cat.png',
      previewUrl: 'blob:queued-cat'
    }

    queue.activateQueue('thread:a')
    composer.activateDraft('thread:a')
    composer.setText('with attachment')
    composer.addAttachment(file)
    queue.enqueueFromComposer('with attachment', [file], [])
    composer.clearDraft()

    queue.activateQueue('thread:b')
    composer.activateDraft('thread:b')
    expect(revoke).not.toHaveBeenCalled()

    queue.discardQueue('thread:a')
    expect(revoke).toHaveBeenCalledWith('blob:queued-cat')
    revoke.mockRestore()
  })
})
