import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { ComposerAttachment } from '../../composables/agent/useComposer'

import { useAgentComposerStore } from './agentComposerStore'

describe('agentComposerStore submission bridge', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
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

    expect(store.takeSubmission(2)).toBeUndefined()
    expect(store.draft).toBe('  Animate this image  ')

    expect(store.takeSubmission(1)).toMatchObject({
      text: 'Animate this image',
      attachments: [attachment]
    })
    expect(store.pendingSubmission).toBeNull()
    expect(store.draft).toBe('')
    expect(store.attachments).toEqual([])
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
})
