import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

import type { ComposerAttachment } from '../../types/composerAttachment'
import { createVideoThumbnail } from '../../utils/videoThumbnail'
import { useAgentComposerStore } from './agentComposerStore'

vi.mock(import('../../utils/videoThumbnail'), () => ({
  createVideoThumbnail: vi.fn<typeof createVideoThumbnail>(
    async () => undefined
  )
}))

const video: ComposerAttachment = {
  id: 'clip',
  name: 'My video',
  ref: '/clip.mp4',
  mediaKind: 'video',
  mediaUrl: '/clip.mp4'
}

type ComposerStore = ReturnType<typeof useAgentComposerStore>

function pendingThumbnail() {
  let resolve!: (value: string | undefined) => void
  const promise = new Promise<string | undefined>((complete) => {
    resolve = complete
  })
  const result = { promise, resolve }
  vi.mocked(createVideoThumbnail).mockReturnValueOnce(result.promise)
  return result
}

beforeEach(() => {
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

describe('composer shared video thumbnail lifetime', () => {
  it('generates once for the included asset and shares the result with every occurrence', async () => {
    const result = pendingThumbnail()
    const store = useAgentComposerStore()
    store.addAttachment(video)
    store.referenceAttachment(video.id)
    store.referenceAttachment(video.id)
    store.updateAttachment(video.id, { name: 'Renamed' })
    expect(createVideoThumbnail).toHaveBeenCalledTimes(1)
    result.resolve('blob:poster')
    await result.promise
    expect(store.attachments[0].previewUrl).toBe('blob:poster')
    expect(store.prompt.references.map((reference) => reference.kind)).toEqual([
      'asset',
      'asset'
    ])
    expect(
      store.prompt.references
        .filter((reference) => reference.kind === 'asset')
        .map((reference) => reference.attachment.previewUrl)
    ).toEqual(['blob:poster', 'blob:poster'])
    store.referenceAttachment(video.id)
    store.updateAttachment(video.id, {
      mediaUrl: '/uploaded.mp4',
      uploading: false
    })
    expect(store.attachments[0].previewUrl).toBe('blob:poster')
    expect(createVideoThumbnail).toHaveBeenCalledTimes(1)
    store.removeReference(`asset:${video.id}`)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    store.removeAttachment(video.id)
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:poster')
  })

  it.for([
    {
      event: 'upload metadata',
      act: (store: ComposerStore) => {
        store.addAttachment({
          id: video.id,
          name: 'clip.mp4',
          ref: '',
          uploading: true
        })
        expect(createVideoThumbnail).not.toHaveBeenCalled()
        store.updateAttachment(video.id, {
          mediaKind: 'video',
          mediaUrl: 'blob:clip'
        })
      }
    },
    {
      event: 'a restored draft',
      act: (store: ComposerStore) =>
        store.replaceDraft({
          text: '',
          workflowReferences: [],
          attachments: [video]
        })
    }
  ])(
    'starts shared capture when the video source arrives through $event',
    async ({ act }) => {
      const result = pendingThumbnail()
      const store = useAgentComposerStore()
      act(store)
      result.resolve('blob:poster')
      await result.promise
      expect(store.attachments[0].previewUrl).toBe('blob:poster')
      expect(createVideoThumbnail).toHaveBeenCalledTimes(1)
    }
  )

  it('uses a trusted poster immediately without decoding video', () => {
    const store = useAgentComposerStore()
    store.replaceDraft({
      text: '',
      workflowReferences: [],
      attachments: [{ ...video, previewUrl: '/server-poster.png' }]
    })
    store.referenceAttachment(video.id)
    expect(store.attachments[0].previewUrl).toBe('/server-poster.png')
    expect(createVideoThumbnail).not.toHaveBeenCalled()
  })

  it.for([
    {
      event: 'removing the asset',
      act: (store: ComposerStore) => store.removeAttachment(video.id)
    },
    {
      event: 'replacing the video source',
      act: (store: ComposerStore) =>
        store.updateAttachment(video.id, { mediaUrl: '/new.mp4' })
    },
    {
      event: 'receiving a trusted poster',
      act: (store: ComposerStore) =>
        store.updateAttachment(video.id, { previewUrl: '/server.png' })
    },
    {
      event: 'disposing the composer',
      act: (store: ComposerStore) => store.$dispose()
    }
  ])(
    'discards and releases an obsolete capture after $event',
    async ({ act }) => {
      const result = pendingThumbnail()
      const store = useAgentComposerStore()
      store.addAttachment(video)
      const signal = vi.mocked(createVideoThumbnail).mock.calls[0][1]
      result.resolve('blob:stale')
      act(store)
      expect(signal.aborted).toBe(true)
      await result.promise
      expect(
        store.attachments.every((asset) => asset.previewUrl !== 'blob:stale')
      ).toBe(true)
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:stale')
    }
  )

  it('does not repeatedly retry failed decoding when referencing or updating the same asset', async () => {
    const result = pendingThumbnail()
    const store = useAgentComposerStore()
    store.addAttachment(video)
    result.resolve(undefined)
    await result.promise
    store.referenceAttachment(video.id)
    store.updateAttachment(video.id, { name: 'Renamed' })
    expect(store.attachments[0].previewUrl).toBeUndefined()
    expect(store.prompt.references).toHaveLength(1)
    expect(createVideoThumbnail).toHaveBeenCalledTimes(1)
  })

  it.for([
    {
      outcome: 'reclaims the poster after a successful send',
      sent: true,
      assertOutcome: (store: ComposerStore) => {
        expect(store.attachments).toEqual([])
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:poster')
      }
    },
    {
      outcome: 'retains the poster when recovering a failed send',
      sent: false,
      assertOutcome: (store: ComposerStore) => {
        const failed = store.takeFailedSubmission()
        assert.exists(failed)
        store.restorePrompt(failed.prompt, failed.attachments)
        expect(store.attachments[0].previewUrl).toBe('blob:poster')
        expect(store.prompt.references).toHaveLength(1)
        expect(URL.revokeObjectURL).not.toHaveBeenCalled()
        expect(createVideoThumbnail).toHaveBeenCalledTimes(1)
      }
    }
  ])(
    '$outcome when capture completes during submission',
    async ({ sent, assertOutcome }) => {
      const result = pendingThumbnail()
      const store = useAgentComposerStore()
      store.addAttachment(video)
      store.referenceAttachment(video.id)
      const id = store.startSubmission({
        prompt: store.prompt,
        attachments: store.attachments,
        nodes: [],
        target: createMockLoadedWorkflow({ path: 'workflows/target.json' })
      })
      result.resolve('blob:poster')
      await result.promise
      store.settleSubmission(id, sent)
      assertOutcome(store)
    }
  )
})
