import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComposerAttachment } from './useComposer'
import { useComposer } from './useComposer'

function setup(streaming = false) {
  const onSend =
    vi.fn<(text: string, attachments: ComposerAttachment[]) => void>()
  const onStop = vi.fn()
  const composer = useComposer({
    onSend,
    onStop,
    isStreaming: () => streaming
  })
  return { composer, onSend, onStop }
}

describe('useComposer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('submit trims the draft, sends it, and clears draft + attachments', () => {
    const { composer, onSend } = setup()
    const attachment: ComposerAttachment = {
      id: 'a1',
      name: 'cat.png',
      ref: 'uploaded_cat.png'
    }
    composer.draft.value = '  make a cat  '
    composer.addAttachment(attachment)

    composer.submit()

    expect(onSend).toHaveBeenCalledWith('make a cat', [attachment])
    expect(composer.draft.value).toBe('')
    expect(composer.attachments.value).toEqual([])
  })

  it('blocks send while any attachment is uploading, unblocks on settle', () => {
    const { composer, onSend } = setup()
    composer.draft.value = 'wire it in'
    composer.addAttachment({
      id: 'u1',
      name: 'cat.png',
      ref: '',
      uploading: true
    })

    expect(composer.canSend.value).toBe(false)
    composer.submit()
    expect(onSend).not.toHaveBeenCalled()

    composer.updateAttachment('u1', {
      ref: 'uploaded_cat.png',
      uploading: false
    })
    expect(composer.canSend.value).toBe(true)
  })

  it('revokes a dismissed blob preview but never a submitted one', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const { composer } = setup()
    composer.addAttachment({
      id: 'a1',
      name: 'a.png',
      ref: 'r1',
      previewUrl: 'blob:a'
    })
    composer.removeAttachment('a1')
    expect(revoke).toHaveBeenCalledWith('blob:a')

    revoke.mockClear()
    composer.draft.value = 'send it'
    composer.addAttachment({
      id: 'a2',
      name: 'b.png',
      ref: 'r2',
      previewUrl: 'blob:b'
    })
    composer.submit()
    expect(revoke).not.toHaveBeenCalled()
    revoke.mockRestore()
  })

  it('allows an attachment-only send with empty text', () => {
    const { composer, onSend } = setup()
    composer.addAttachment({ id: 'a1', name: 'cat.png', ref: 'r' })

    expect(composer.canSend.value).toBe(true)
    composer.submit()

    expect(onSend).toHaveBeenCalledWith('', [
      { id: 'a1', name: 'cat.png', ref: 'r' }
    ])
  })

  it('does not send when there is neither text nor an attachment', () => {
    const { composer, onSend } = setup()
    composer.draft.value = '   '

    expect(composer.canSend.value).toBe(false)
    composer.submit()

    expect(onSend).not.toHaveBeenCalled()
  })

  it('routes submit to stop while streaming, without sending', () => {
    const { composer, onSend, onStop } = setup(true)
    composer.draft.value = 'ignored while streaming'

    composer.submit()

    expect(onStop).toHaveBeenCalledOnce()
    expect(onSend).not.toHaveBeenCalled()
    expect(composer.draft.value).toBe('ignored while streaming')
  })

  it('insert appends to the draft without sending', () => {
    const { composer, onSend } = setup()
    composer.insert('first')
    composer.insert('second')

    expect(composer.draft.value).toBe('first second')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('a recreated composer rehydrates the pending draft and attachments', () => {
    const first = setup().composer
    first.draft.value = 'still here'
    first.addAttachment({ id: 'a1', name: 'cat.png', ref: 'r' })

    const { composer: second, onSend } = setup()
    expect(second.draft.value).toBe('still here')
    expect(second.attachments.value.map((a) => a.id)).toEqual(['a1'])

    second.submit()
    expect(onSend).toHaveBeenCalledWith('still here', [
      { id: 'a1', name: 'cat.png', ref: 'r' }
    ])
    expect(first.draft.value).toBe('')
    expect(first.attachments.value).toEqual([])
  })

  it('removeAttachment drops the matching staged attachment', () => {
    const { composer } = setup()
    composer.addAttachment({ id: 'a1', name: 'a.png', ref: 'ra' })
    composer.addAttachment({ id: 'a2', name: 'b.png', ref: 'rb' })

    composer.removeAttachment('a1')

    expect(composer.attachments.value.map((a) => a.id)).toEqual(['a2'])
  })
})
