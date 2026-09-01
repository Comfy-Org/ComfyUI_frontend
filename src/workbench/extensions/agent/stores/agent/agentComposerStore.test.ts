import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComposerAttachment } from '../../composables/agent/useComposer'

import { useAgentComposerStore } from './agentComposerStore'

describe('agentComposerStore submission bridge', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('snapshots and consumes one submission', () => {
    const store = useAgentComposerStore()
    const attachment: ComposerAttachment = {
      id: 'image-1',
      name: 'reference.png',
      ref: 'reference.png'
    }
    store.draft = '  Animate this image  '
    store.attachments = [attachment]

    expect(store.requestSubmission()).toBe(true)
    expect(store.pendingSubmission).toMatchObject({
      id: 1,
      text: 'Animate this image',
      attachments: [attachment]
    })
    expect(store.compactSessionPhase).toBe('queued')

    expect(store.takeSubmission(2)).toBeUndefined()
    expect(store.draft).toBe('  Animate this image  ')

    expect(store.takeSubmission(1)).toMatchObject({
      text: 'Animate this image',
      attachments: [attachment]
    })
    expect(store.pendingSubmission).toBeNull()
    expect(store.draft).toBe('')
    expect(store.attachments).toEqual([])
    expect(store.compactSessionPhase).toBe('sending')

    store.markCompactSessionRunning()
    expect(store.compactSessionPhase).toBe('running')

    store.finishCompactSession()
    expect(store.compactSessionPhase).toBe('idle')
  })

  it('blocks empty, uploading, and duplicate submissions', () => {
    const store = useAgentComposerStore()

    expect(store.requestSubmission()).toBe(false)

    store.attachments = [
      {
        id: 'upload-1',
        name: 'uploading.png',
        ref: '',
        uploading: true
      }
    ]
    expect(store.requestSubmission()).toBe(false)

    store.attachments = []
    store.draft = 'Build a workflow'
    expect(store.requestSubmission()).toBe(true)
    store.draft = 'Do not replace the queued request'
    expect(store.requestSubmission()).toBe(false)
    expect(store.pendingSubmission?.text).toBe('Build a workflow')
  })

  it('releases only the current request without discarding its draft', () => {
    const store = useAgentComposerStore()
    store.draft = 'Keep this prompt available for retry'

    expect(store.requestSubmission()).toBe(true)
    expect(store.releaseSubmission(2)).toBe(false)
    expect(store.pendingSubmission?.id).toBe(1)

    expect(store.releaseSubmission(1)).toBe(true)
    expect(store.pendingSubmission).toBeNull()
    expect(store.draft).toBe('Keep this prompt available for retry')
    expect(store.canSubmit).toBe(true)
    expect(store.compactSessionPhase).toBe('idle')
  })

  it('restores a consumed request for retry after a transport failure', () => {
    const store = useAgentComposerStore()
    const attachment: ComposerAttachment = {
      id: 'image-1',
      name: 'reference.png',
      ref: 'reference.png'
    }
    store.draft = 'Build this again'
    store.attachments = [attachment]
    store.requestSubmission()
    store.takeSubmission(1)

    store.restoreCompactSubmission('Build this again', [attachment])

    expect(store.draft).toBe('Build this again')
    expect(store.attachments).toEqual([attachment])
    expect(store.compactSessionPhase).toBe('idle')
    expect(store.canSubmit).toBe(true)
  })

  it('queues file attachments for the existing Agent runtime in order', () => {
    const store = useAgentComposerStore()
    const first = new File(['first'], 'first.png', { type: 'image/png' })
    const second = new File(['second'], 'second.png', { type: 'image/png' })

    expect(store.requestAttachments([])).toBe(false)
    expect(store.requestAttachments([first])).toBe(true)
    expect(store.requestAttachments([second])).toBe(true)
    expect(store.hasPendingAttachmentWork).toBe(true)
    store.draft = 'Do not send without the references'
    expect(store.canSubmit).toBe(false)

    expect(store.takeAttachmentRequest()?.files).toEqual([first])
    expect(store.takeAttachmentRequest()?.files).toEqual([second])
    expect(store.takeAttachmentRequest()).toBeUndefined()
    expect(store.hasPendingAttachmentWork).toBe(false)
    expect(store.canSubmit).toBe(true)
  })

  it('owns shared attachment state and revokes only removed blob previews', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const store = useAgentComposerStore()
    store.addAttachment({
      id: 'upload-1',
      name: 'reference.png',
      ref: '',
      previewUrl: 'blob:reference',
      uploading: true
    })
    store.addAttachment({ id: 'upload-1', name: 'duplicate.png', ref: '' })

    expect(store.attachments).toHaveLength(1)
    expect(store.hasPendingAttachmentWork).toBe(true)
    store.updateAttachment('upload-1', {
      ref: 'uploaded_reference.png',
      uploading: false
    })
    expect(store.canSubmit).toBe(true)

    store.removeAttachment('upload-1')
    expect(revoke).toHaveBeenCalledWith('blob:reference')
    expect(store.attachments).toEqual([])
    revoke.mockRestore()
  })
})
