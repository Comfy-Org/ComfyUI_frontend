import { describe, expect, it, vi } from 'vitest'

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
    // The draft is preserved on stop (only a real send clears it).
    expect(composer.draft.value).toBe('ignored while streaming')
  })

  it('insert appends to the draft without sending', () => {
    const { composer, onSend } = setup()
    composer.insert('first')
    composer.insert('second')

    expect(composer.draft.value).toBe('first second')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('removeAttachment drops the matching staged attachment', () => {
    const { composer } = setup()
    composer.addAttachment({ id: 'a1', name: 'a.png', ref: 'ra' })
    composer.addAttachment({ id: 'a2', name: 'b.png', ref: 'rb' })

    composer.removeAttachment('a1')

    expect(composer.attachments.value.map((a) => a.id)).toEqual(['a2'])
  })
})
