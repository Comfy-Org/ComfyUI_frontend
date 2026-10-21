import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { ConfigProvider } from 'reka-ui'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import Dialog from './Dialog.vue'
import DialogContent from './DialogContent.vue'
import DialogPortal from './DialogPortal.vue'
import DialogTitle from './DialogTitle.vue'

describe('DialogPortal', () => {
  it('reopens after a later dialog and accepts input', async () => {
    const open = ref(true)
    const secondOpen = ref(false)
    render({
      components: { Dialog, DialogContent, DialogPortal, DialogTitle },
      setup: () => ({ open, secondOpen }),
      template: `
        <Dialog v-model:open="open">
          <DialogPortal>
            <DialogContent :aria-describedby="undefined">
              <DialogTitle>First</DialogTitle>
              <input aria-label="Name" />
            </DialogContent>
          </DialogPortal>
        </Dialog>
        <Dialog v-model:open="secondOpen"><DialogPortal><DialogContent :aria-describedby="undefined">
          <DialogTitle>Second</DialogTitle>
        </DialogContent></DialogPortal></Dialog>
      `
    })
    await screen.findByRole('dialog', { name: 'First' })
    open.value = false
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    secondOpen.value = true
    const later = await screen.findByRole('dialog', { name: 'Second' })
    open.value = true
    const reopened = await screen.findByRole('dialog', { name: 'First' })
    expect(later.compareDocumentPosition(reopened)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
    const user = userEvent.setup()
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'New name')
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue(
      'New name'
    )
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
    expect(await screen.findByRole('dialog', { name: 'Second' })).toBeVisible()
  })

  it('keeps a closing dialog mounted until its exit animation ends', async () => {
    const open = ref(true)
    render({
      components: { Dialog, DialogContent, DialogPortal, DialogTitle },
      setup: () => ({ open }),
      template: `
        <component is="style">
          [data-state=open] { animation-name: enter }
          [data-state=closed] { animation-name: exit }
        </component>
        <Dialog v-model:open="open">
          <DialogPortal>
            <DialogContent :aria-describedby="undefined">
              <DialogTitle>Closing</DialogTitle>
            </DialogContent>
          </DialogPortal>
        </Dialog>
      `
    })
    const dialog = await screen.findByRole('dialog', { name: 'Closing' })
    open.value = false
    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))
    expect(dialog).toBeInTheDocument()
    dialog.dispatchEvent(
      new AnimationEvent('animationend', { animationName: 'exit' })
    )
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
  })

  it.for([false, true])(
    'forwards the target with disabled=%s',
    async (disabled) => {
      render({ template: '<section aria-label="Target" />' })
      const destination = screen.getByRole('region', { name: 'Target' })
      const { container } = render({
        components: { ConfigProvider, Dialog, DialogPortal },
        setup: () => ({ destination, disabled }),
        template: `
        <ConfigProvider teleport-to="body">
          <Dialog open>
            <DialogPortal :to="destination" :disabled><button>Action</button></DialogPortal>
          </Dialog>
        </ConfigProvider>
      `
      })
      const action = await screen.findByRole('button', { name: 'Action' })
      expect(disabled ? container : destination).toContainElement(action)
    }
  )
})
