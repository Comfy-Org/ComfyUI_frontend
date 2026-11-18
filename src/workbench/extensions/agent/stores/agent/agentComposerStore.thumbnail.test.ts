import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComposerAttachment } from '@/workbench/extensions/agent/types/composerAttachment'
import * as videoThumbnail from '@/workbench/extensions/agent/utils/videoThumbnail'
import { useAgentComposerStore } from './agentComposerStore'

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
  vi.mocked(videoThumbnail.createVideoThumbnail).mockReturnValueOnce(
    result.promise
  )
  return result
}

beforeEach(() => {
  vi.spyOn(videoThumbnail, 'createVideoThumbnail').mockResolvedValue(undefined)
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

describe('composer shared video thumbnail lifetime', () => {
  function retainPendingVideo(
    clientMessageId: string,
    composer: ComposerStore
  ): void {
    composer.retainAssets(
      `pending:${clientMessageId}`,
      composer.attachments.map(({ id }) => id)
    )
  }

  it('cancels a removed pending send capture and rejects its late poster while a new draft remains usable', async () => {
    const obsolete = pendingThumbnail()
    const current = pendingThumbnail()
    const store = useAgentComposerStore()
    store.addAttachment({ ...video, mediaUrl: 'blob:old-video' })
    const obsoleteSignal = vi.mocked(videoThumbnail.createVideoThumbnail).mock
      .calls[0][1]
    retainPendingVideo('cm-1', store)
    const gateId = store.startGateHold('cm-1')
    store.addAttachment({
      ...video,
      id: 'new-video',
      mediaUrl: 'blob:new-video'
    })
    const currentSignal = vi.mocked(videoThumbnail.createVideoThumbnail).mock
      .calls[1][1]
    store.setText('New chat draft')
    store.releaseRetainedAssets('pending:cm-1')
    store.releaseGateHold(gateId)
    expect(obsoleteSignal.aborted).toBe(true)
    expect(currentSignal.aborted).toBe(false)
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      'blob:old-video'
    )
    obsolete.resolve('blob:late-poster')
    current.resolve('blob:current-poster')
    await Promise.all([obsolete.promise, current.promise])
    expect(store.draft).toBe('New chat draft')
    expect(store.attachments).toMatchObject([
      { id: 'new-video', previewUrl: 'blob:current-poster' }
    ])
    expect(store.referenceAttachment(video.id)).toBe(false)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:late-poster')
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:new-video')
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:current-poster')
  })

  it('releases the current poster completed during a settled pending send exactly once', async () => {
    const result = pendingThumbnail()
    const store = useAgentComposerStore()
    store.addAttachment({ ...video, mediaUrl: 'blob:video' })
    retainPendingVideo('cm-1', store)
    const gateId = store.startGateHold('cm-1')
    result.resolve('blob:completed-poster')
    await result.promise
    store.releaseRetainedAssets('pending:cm-1')
    store.releaseGateHold(gateId)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:video')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:completed-poster')
    expect(store.attachments).toEqual([])
  })

  it('keeps a pending asset and decoder retained through gate withdrawal and a repeated send', async () => {
    const result = pendingThumbnail()
    const store = useAgentComposerStore()
    store.addAttachment({ ...video, mediaUrl: 'blob:retained-video' })
    store.referenceAttachment(video.id)
    const snapshot = {
      prompt: store.prompt,
      attachments: [...store.attachments],
      nodes: [],
      targetPath: null,
      promptOrigin: store.promptOrigin,
      starterPrompt: store.starterPrompt
    }
    retainPendingVideo('cm-1', store)
    const gateId = store.startGateHold('cm-1', snapshot)
    const cancelled = store.cancelGateHold()
    store.releaseGateHold(gateId)
    store.restorePrompt(snapshot.prompt, cancelled?.snapshot.attachments ?? [])
    store.releaseRetainedAssets('pending:cm-1')
    expect(
      vi.mocked(videoThumbnail.createVideoThumbnail).mock.calls[0][1].aborted
    ).toBe(false)
    result.resolve('blob:retained-poster')
    await result.promise
    expect(store.attachments[0].previewUrl).toBe('blob:retained-poster')
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    retainPendingVideo('cm-2', store)
    const secondGate = store.startGateHold('cm-2')
    store.releaseGateHold(secondGate)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    expect(videoThumbnail.createVideoThumbnail).toHaveBeenCalledTimes(1)
  })

  it('generates once for the included asset and shares the result with every occurrence', async () => {
    const result = pendingThumbnail()
    const store = useAgentComposerStore()
    store.addAttachment(video)
    store.referenceAttachment(video.id)
    store.referenceAttachment(video.id)
    store.updateAttachment(video.id, { name: 'Renamed' })
    expect(videoThumbnail.createVideoThumbnail).toHaveBeenCalledTimes(1)
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
    expect(videoThumbnail.createVideoThumbnail).toHaveBeenCalledTimes(1)
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
        expect(videoThumbnail.createVideoThumbnail).not.toHaveBeenCalled()
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
      expect(videoThumbnail.createVideoThumbnail).toHaveBeenCalledTimes(1)
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
    expect(videoThumbnail.createVideoThumbnail).not.toHaveBeenCalled()
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
      const signal = vi.mocked(videoThumbnail.createVideoThumbnail).mock
        .calls[0][1]
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
    expect(videoThumbnail.createVideoThumbnail).toHaveBeenCalledTimes(1)
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
      outcome: 'retains the poster while retained by a failed send owner',
      sent: false,
      assertOutcome: (_store: ComposerStore, previews: string[]) => {
        expect(previews).toEqual(['blob:poster'])
        expect(URL.revokeObjectURL).not.toHaveBeenCalled()
        expect(videoThumbnail.createVideoThumbnail).toHaveBeenCalledTimes(1)
      }
    }
  ])(
    '$outcome when capture completes during submission',
    async ({ sent, assertOutcome }) => {
      const result = pendingThumbnail()
      const store = useAgentComposerStore()
      const previews: string[] = []
      store.onAssetPreviewUpdated(({ previewUrl }) => previews.push(previewUrl))
      store.addAttachment(video)
      store.referenceAttachment(video.id)
      retainPendingVideo('cm-1', store)
      const gateId = store.startGateHold('cm-1')
      result.resolve('blob:poster')
      await result.promise
      if (sent) store.releaseRetainedAssets('pending:cm-1')
      store.releaseGateHold(gateId)
      assertOutcome(store, previews)
    }
  )
})
