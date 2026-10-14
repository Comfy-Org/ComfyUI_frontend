import { describe, expect, it, vi } from 'vitest'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { useAttachment } from './useAttachment'
import { useComposer } from './useComposer'

vi.mock(import('@/platform/telemetry'))

describe('attachment validation staging', () => {
  it('stages every file while the video header is pending', async () => {
    let finish: (value: boolean) => void = () => {}
    const validation = new Promise<boolean>((resolve) => {
      finish = resolve
    })
    const store = useAgentComposerStore()
    const attachment = useAttachment({
      validate: (file) => (file.name.endsWith('.mp4') ? validation : true),
      upload: async (file) => ({ ref: file.name }),
      staged: () => store.attachments,
      stage: store.addAttachment,
      update: store.updateAttachment,
      remove: store.removeAttachment
    })
    const pending = attachment.addFiles([
      new File(['text'], 'notes.txt'),
      new File(['\0\0\0\x18ftyp'], 'clip.mp4'),
      new File(['text'], 'readme.md')
    ])
    const staged = store.attachments.map(({ name }) => name)
    finish(true)
    await pending
    expect(staged).toEqual(['notes.txt', 'clip.mp4', 'readme.md'])
  })

  it('blocks submission while a selected video header is pending', async () => {
    let finish: (value: boolean) => void = () => {}
    const validation = new Promise<boolean>((resolve) => {
      finish = resolve
    })
    const store = useAgentComposerStore()
    const onSend = vi.fn()
    const composer = useComposer({
      onSend,
      onStop: vi.fn(),
      isRunning: () => false
    })
    const attachment = useAttachment({
      validate: () => validation,
      upload: async (file) => ({ ref: file.name }),
      staged: () => store.attachments,
      stage: store.addAttachment,
      update: store.updateAttachment,
      remove: store.removeAttachment
    })
    composer.setText('Describe this video')
    const pending = attachment.addFiles([
      new File(['\0\0\0\x18ftyp'], 'clip.mp4')
    ])
    composer.submit()
    const submitted = onSend.mock.calls.length
    finish(true)
    await pending
    expect(submitted).toBe(0)
    composer.submit()
    expect(onSend).toHaveBeenCalledExactlyOnceWith(
      'Describe this video',
      expect.arrayContaining([
        expect.objectContaining({
          name: 'clip.mp4',
          ref: 'clip.mp4',
          uploading: false
        })
      ])
    )
  })

  it('keeps invalid files visible and blocks a mixed batch until they are removed', async () => {
    const store = useAgentComposerStore()
    const onSend = vi.fn()
    const onError = vi.fn()
    const upload = vi.fn(async (file: File) => ({ ref: file.name }))
    const composer = useComposer({
      onSend,
      onStop: vi.fn(),
      isRunning: () => false
    })
    const attachment = useAttachment({
      validate: (file) => file.name === 'notes.txt',
      upload,
      onError,
      staged: () => store.attachments,
      stage: store.addAttachment,
      update: store.updateAttachment,
      remove: store.removeAttachment
    })
    composer.setText('Describe these files')
    const files = [
      new File(['text'], 'bad.mp4'),
      new File(['text'], 'bad.mov'),
      new File(['text'], 'notes.txt')
    ]
    await attachment.addFiles(files)
    attachment.cancelAllUploads()
    expect(store.attachments).toMatchObject([
      { name: 'bad.mp4', uploading: false, validationError: 'invalid-video' },
      { name: 'bad.mov', uploading: false, validationError: 'invalid-video' },
      { name: 'notes.txt', ref: 'notes.txt', uploading: false }
    ])
    expect(upload).toHaveBeenCalledExactlyOnceWith(
      files[2],
      expect.any(AbortSignal)
    )
    expect(onError).not.toHaveBeenCalled()
    composer.submit()
    expect(onSend).not.toHaveBeenCalled()
    store.removeAttachment(store.attachments[0].id)
    composer.submit()
    expect(onSend).not.toHaveBeenCalled()
    store.removeAttachment(store.attachments[0].id)
    composer.submit()
    expect(onSend).toHaveBeenCalledExactlyOnceWith('Describe these files', [
      expect.objectContaining({ name: 'notes.txt' })
    ])
  })
})
