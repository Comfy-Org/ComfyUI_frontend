import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { ConfigProvider } from 'reka-ui'
import { describe, expect, it } from 'vitest'

import Popover from '@/components/ui/Popover.vue'
import ToastDock from './ToastDock.vue'

describe('ToastDock', () => {
  it('keeps descendant popovers in the toast tier and inherits provider direction', async () => {
    render({
      components: { ConfigProvider, Popover, ToastDock },
      template: `
        <ConfigProvider dir="rtl">
          <ToastDock data-testid="dock">
            <Popover>
              <template #button><button>Details</button></template>
              <button>Popover action</button>
            </Popover>
          </ToastDock>
        </ConfigProvider>
      `
    })
    render({
      template:
        '<section class="fixed z-overlay" data-testid="existing-overlay" />'
    })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Details' }))

    const dock = screen.getByTestId('dock')
    expect(dock).toHaveClass('z-toast')
    expect(await within(dock).findByRole('dialog')).toHaveAttribute(
      'dir',
      'rtl'
    )
    expect(
      within(dock).getByRole('button', { name: 'Popover action' })
    ).toBeVisible()
  })
})
