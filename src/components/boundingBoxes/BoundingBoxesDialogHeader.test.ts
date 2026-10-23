import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import BoundingBoxesDialogHeader from './BoundingBoxesDialogHeader.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close' },
      boundingBoxes: { editorTitle: 'Bounding Boxes' }
    }
  }
})

it('titles the editor, hosts the toolbar slot and closes its dialog', async () => {
  const onUpdateOpen = vi.fn()
  render(
    {
      components: { Dialog, BoundingBoxesDialogHeader },
      setup: () => ({ onUpdateOpen }),
      template: `
        <Dialog open @update:open="onUpdateOpen">
          <BoundingBoxesDialogHeader />
        </Dialog>
      `
    },
    { global: { plugins: [i18n] } }
  )

  expect(
    screen.getByRole('heading', { name: 'Bounding Boxes' })
  ).toBeInTheDocument()
  expect(screen.getByRole('group')).toHaveAttribute(
    'id',
    'bounding-boxes-header-actions'
  )

  await userEvent.click(screen.getAllByRole('button', { name: 'Close' })[0])
  expect(onUpdateOpen).toHaveBeenCalledWith(false)
})
