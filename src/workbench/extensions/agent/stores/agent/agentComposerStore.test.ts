import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

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
})
