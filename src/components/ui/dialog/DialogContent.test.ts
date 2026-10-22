import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'

import Dialog from './Dialog.vue'
import DialogContent from './DialogContent.vue'
import DialogTitle from './DialogTitle.vue'

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

describe('DialogContent', () => {
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
