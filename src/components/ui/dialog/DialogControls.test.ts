import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'

import Dialog from './Dialog.vue'
import DialogClose from './DialogClose.vue'
import DialogMaximize from './DialogMaximize.vue'
import DialogPanel from './DialogPanel.vue'

it('uses the supplied close label and closes its dialog', async () => {
  const onUpdateOpen = vi.fn()
  render({
    components: { Dialog, DialogClose },
    setup: () => ({ onUpdateOpen }),
    template: `
      <Dialog open @update:open="onUpdateOpen">
        <DialogClose close-label="Dismiss settings" />
      </Dialog>
    `
  })

  await userEvent.click(
    screen.getByRole('button', { name: 'Dismiss settings' })
  )

  expect(onUpdateOpen).toHaveBeenCalledWith(false)
})

it('uses the supplied panel close label and calls its close handler', async () => {
  const onClose = vi.fn()
  render({
    components: { Dialog, DialogPanel },
    setup: () => ({ onClose }),
    template: `
      <Dialog open>
        <DialogPanel close-label="Dismiss panel" :on-close="onClose">
          <template #title>Settings</template>
        </DialogPanel>
      </Dialog>
    `
  })

  await userEvent.click(screen.getByRole('button', { name: 'Dismiss panel' }))

  expect(onClose).toHaveBeenCalledOnce()
})

it('switches supplied maximize labels with maximized state and emits toggle', async () => {
  const onToggle = vi.fn()
  const { rerender } = render(DialogMaximize, {
    props: {
      maximizeLabel: 'Expand settings',
      restoreLabel: 'Shrink settings',
      onToggle
    }
  })

  await userEvent.click(screen.getByRole('button', { name: 'Expand settings' }))
  expect(onToggle).toHaveBeenCalledOnce()

  await rerender({ maximized: true })

  expect(screen.getByRole('button', { name: 'Shrink settings' })).toBeVisible()
})
