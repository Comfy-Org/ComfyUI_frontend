import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import Composer from './Composer.vue'
import { setupInlinePromptEditorDom } from './composer/inlinePromptEditorTestSetup'

setupInlinePromptEditorDom()

function clipboardOf(...files: File[]): DataTransfer {
  const clipboard = new DataTransfer()
  for (const file of files) clipboard.items.add(file)
  return clipboard
}

function mount() {
  return render(Composer, {
    props: { hasWorkflowTarget: true },
    global: { plugins: [i18n], directives: { tooltip: () => {} } }
  })
}

describe('pasting files into the composer', () => {
  it('hands a pasted screenshot to the host as an attachment', async () => {
    const user = userEvent.setup()
    const view = mount()
    const screenshot = new File(['x'], '', { type: 'image/png' })

    await user.click(screen.getByRole('textbox'))
    await user.paste(clipboardOf(screenshot))

    expect(view.emitted().attachFiles).toEqual([
      [[expect.objectContaining({ name: 'pasted-image.png' })]]
    ])
  })

  it('attaches every attachable file in one paste', async () => {
    const user = userEvent.setup()
    const view = mount()

    await user.click(screen.getByRole('textbox'))
    await user.paste(
      clipboardOf(
        new File(['x'], 'first.png', { type: 'image/png' }),
        new File(['x'], 'notes.md', { type: '' }),
        new File(['x'], 'archive.zip', { type: 'application/zip' })
      )
    )

    const [[attached]] = view.emitted<[File[]]>().attachFiles
    expect(attached.map((file) => file.name)).toEqual(['first.png', 'notes.md'])
  })

  it.for(['plain clipboard text', ''])(
    'still pastes text and attaches nothing for %o',
    async (text) => {
      const user = userEvent.setup()
      const view = mount()
      const editor = screen.getByRole('textbox')

      await user.click(editor)
      await user.paste(text)

      expect(view.emitted().attachFiles).toBeUndefined()
      expect(editor).toHaveTextContent(text)
    }
  )

  it('leaves the paste to the editor when no clipboard file is attachable', async () => {
    const user = userEvent.setup()
    const view = mount()
    const clipboard = clipboardOf(
      new File(['x'], 'archive.zip', { type: 'application/zip' })
    )
    clipboard.setData('text/plain', 'fallback text')

    await user.click(screen.getByRole('textbox'))
    await user.paste(clipboard)

    expect(view.emitted().attachFiles).toBeUndefined()
    expect(screen.getByRole('textbox')).toHaveTextContent('fallback text')
  })
})
