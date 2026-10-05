import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    for (const reference of store.prompt.references) {
      expect(reference.kind).toBe('asset')
      if (reference.kind === 'asset')
        expect(reference.attachment.previewUrl).toBe('blob:poster')
    }
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

  it.for(['upload-metadata', 'restored-draft'] as const)(
    'starts shared capture when the video source arrives through %s',
    async (event) => {
      const result = pendingThumbnail()
      const store = useAgentComposerStore()
      if (event === 'upload-metadata') {
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
      } else
        store.replaceDraft({
          text: '',
          workflowReferences: [],
          attachments: [video]
        })
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

  it.for(['remove', 'replace', 'poster', 'dispose'] as const)(
    'discards and releases an obsolete capture after %s',
    async (event) => {
      const result = pendingThumbnail()
      const store = useAgentComposerStore()
      store.addAttachment(video)
      const signal = vi.mocked(createVideoThumbnail).mock.calls[0][1]
      result.resolve('blob:stale')
      if (event === 'remove') store.removeAttachment(video.id)
      if (event === 'replace')
        store.updateAttachment(video.id, { mediaUrl: '/new.mp4' })
      if (event === 'poster')
        store.updateAttachment(video.id, { previewUrl: '/server.png' })
      if (event === 'dispose') store.$dispose()
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

  it.for([true, false])(
    'retains/reclaims a poster completed during submission (sent=%s)',
    async (sent) => {
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
      if (sent) {
        expect(store.attachments).toEqual([])
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:poster')
      } else {
        const failed = store.takeFailedSubmission()
        expect(failed).toBeDefined()
        if (!failed) throw new Error('Expected failed draft')
        store.restorePrompt(failed.prompt, failed.attachments)
        expect(store.attachments[0].previewUrl).toBe('blob:poster')
        expect(store.prompt.references).toHaveLength(1)
        expect(URL.revokeObjectURL).not.toHaveBeenCalled()
        expect(createVideoThumbnail).toHaveBeenCalledTimes(1)
      }
    }
  )
})
