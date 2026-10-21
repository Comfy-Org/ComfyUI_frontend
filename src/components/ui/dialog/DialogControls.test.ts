import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'

import Dialog from './Dialog.vue'
import DialogClose from './DialogClose.vue'
import DialogMaximize from './DialogMaximize.vue'
import DialogPanel from './DialogPanel.vue'

it.for([
  { name: 'default button', content: '' },
  { name: 'custom button', content: '<Button>Custom close</Button>' }
])(
  'forwards native labels to the $name and closes its dialog',
  async ({ content }) => {
    const onUpdateOpen = vi.fn()
    render({
      components: { Button, Dialog, DialogClose },
      setup: () => ({ onUpdateOpen }),
      template: `
      <Dialog open @update:open="onUpdateOpen">
        <DialogClose aria-label="Dismiss settings">${content}</DialogClose>
      </Dialog>
    `
    })

    await userEvent.click(
      screen.getByRole('button', { name: 'Dismiss settings' })
    )

    expect(onUpdateOpen).toHaveBeenCalledWith(false)
  }
)

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
  render({
    components: { DialogMaximize },
    setup: () => ({ maximized: ref(false) }),
    template: `
      <DialogMaximize
        :maximized="maximized"
        :aria-label="maximized ? 'Shrink settings' : 'Expand settings'"
        @toggle="maximized = !maximized"
      />
    `
  })

  await userEvent.click(screen.getByRole('button', { name: 'Expand settings' }))
  expect(screen.getByRole('button', { name: 'Shrink settings' })).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Shrink settings' }))
  expect(screen.getByRole('button', { name: 'Expand settings' })).toBeVisible()
})
