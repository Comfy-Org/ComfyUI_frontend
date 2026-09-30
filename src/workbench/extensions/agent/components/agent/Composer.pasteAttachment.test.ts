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
    const screenshot = new File(['x'], 'image.png', { type: 'image/png' })

    await user.click(screen.getByRole('textbox'))
    await user.paste(clipboardOf(screenshot))

    expect(view.emitted().attachFiles).toEqual([[[screenshot]]])
  })

  it('forwards every pasted file, leaving the accept decision to the composer', async () => {
    // The editor deliberately does not filter: the composer's addFiles is the
    // single gate, and it is what reports a type it will not take. Filtering
    // here made a rejected paste look like pasting nothing (PM-1856).
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
    expect(attached.map((file) => file.name)).toEqual([
      'first.png',
      'notes.md',
      'archive.zip'
    ])
  })

  it('attaches the file and still pastes the text a mixed clipboard carries', async () => {
    const user = userEvent.setup()
    const view = mount()
    const editor = screen.getByRole('textbox')
    const clipboard = clipboardOf(
      new File(['x'], 'chart.png', { type: 'image/png' })
    )
    clipboard.setData('text/plain', 'Quarterly revenue')

    await user.click(editor)
    await user.paste(clipboard)

    expect(view.emitted().attachFiles).toHaveLength(1)
    expect(editor).toHaveTextContent('Quarterly revenue')
  })

  it('keeps the selected text when a screenshot is pasted over it', async () => {
    const user = userEvent.setup()
    const view = mount()
    const editor = screen.getByRole('textbox')

    await user.click(editor)
    await user.paste('keep me')
    await user.keyboard('{Control>}a{/Control}')
    await user.paste(
      clipboardOf(new File(['x'], 'image.png', { type: 'image/png' }))
    )

    expect(view.emitted().attachFiles).toHaveLength(1)
    expect(editor).toHaveTextContent('keep me')
  })

  it('keeps the selected text when only an unattachable file is pasted', async () => {
    const user = userEvent.setup()
    const view = mount()
    const editor = screen.getByRole('textbox')

    await user.click(editor)
    await user.paste('keep me')
    await user.keyboard('{Control>}a{/Control}')
    await user.paste(
      clipboardOf(new File(['x'], 'archive.zip', { type: 'application/zip' }))
    )

    // Forwarded so the composer can refuse it out loud; the draft the paste
    // would have replaced is still untouched.
    expect(view.emitted().attachFiles).toHaveLength(1)
    expect(editor).toHaveTextContent('keep me')
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

  it('still pastes the text a mixed clipboard carries when its file is unattachable', async () => {
    const user = userEvent.setup()
    const view = mount()
    const clipboard = clipboardOf(
      new File(['x'], 'archive.zip', { type: 'application/zip' })
    )
    clipboard.setData('text/plain', 'fallback text')

    await user.click(screen.getByRole('textbox'))
    await user.paste(clipboard)

    expect(view.emitted().attachFiles).toHaveLength(1)
    expect(screen.getByRole('textbox')).toHaveTextContent('fallback text')
  })
})
