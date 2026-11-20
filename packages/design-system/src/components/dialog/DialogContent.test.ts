import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'

import Dialog from '@comfyorg/design-system/dialog/Dialog'
import DialogContent from '@comfyorg/design-system/dialog/DialogContent'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'

const TestDialog = defineComponent({
  components: { Dialog, DialogContent, DialogTitle },
  props: { autofocus: Boolean },
  template: `
    <Dialog open>
      <DialogContent :aria-describedby="undefined">
        <DialogTitle>Search nodes</DialogTitle>
        <input aria-label="Add a node" :autofocus="autofocus" />
        <button>Other control</button>
      </DialogContent>
    </Dialog>
  `
})

const GrowingDialog = defineComponent({
  components: { Dialog, DialogContent, DialogTitle },
  props: { growsDown: Boolean },
  template: `
    <Dialog open>
      <DialogContent :grows-down="growsDown" :aria-describedby="undefined">
        <DialogTitle>Add credits</DialogTitle>
      </DialogContent>
    </Dialog>
  `
})

describe('DialogContent', () => {
  it.for([
    { height: 300, top: '250px', maxHeight: 'calc(100dvh - 266px)' },
    { height: 900, top: '16px', maxHeight: 'calc(100dvh - 32px)' }
  ])(
    'pins a $height px tall growsDown dialog at top $top',
    async ({ height, top, maxHeight }) => {
      vi.stubGlobal('innerHeight', 800)
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(
        height
      )

      render(GrowingDialog, { props: { growsDown: true } })

      await waitFor(() =>
        expect(screen.getByRole('dialog').style).toMatchObject({
          top,
          maxHeight
        })
      )
    }
  )

  it('moves a growsDown dialog back into view when the window shrinks', async () => {
    vi.stubGlobal('innerHeight', 1800)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400)
    render(GrowingDialog, { props: { growsDown: true } })
    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(dialog.style.top).toBe('700px'))

    vi.stubGlobal('innerHeight', 600)
    window.dispatchEvent(new Event('resize'))

    await waitFor(() =>
      expect(dialog.style).toMatchObject({
        top: '100px',
        maxHeight: 'calc(100dvh - 116px)'
      })
    )
  })

  it('leaves a dialog without growsDown centred', async () => {
    render(GrowingDialog)
    await nextTick()

    expect(screen.getByRole('dialog').style.top).toBe('')
  })

  it.for([
    { autofocus: true, focusedRole: 'textbox' },
    { autofocus: false, focusedRole: 'dialog' }
  ])(
    'focuses $focusedRole when focus falls back to the container with autofocus=$autofocus',
    async ({ autofocus, focusedRole }) => {
      render(TestDialog, { props: { autofocus } })
      await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus())

      screen.getByRole('dialog').focus()

      expect(screen.getByRole(focusedRole)).toHaveFocus()
    }
  )

  it('does not redirect focus from another control inside the dialog', async () => {
    const user = userEvent.setup()
    render(TestDialog, { props: { autofocus: true } })
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus())

    await user.click(screen.getByRole('button', { name: 'Other control' }))

    expect(screen.getByRole('button', { name: 'Other control' })).toHaveFocus()
  })
})
