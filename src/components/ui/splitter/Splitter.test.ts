import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'

import SplitterGroup from './SplitterGroup.vue'
import SplitterPanel from './SplitterPanel.vue'
import SplitterResizeHandle from './SplitterResizeHandle.vue'

it.for([
  { direction: 'horizontal', key: '{ArrowRight}' },
  { direction: 'vertical', key: '{ArrowDown}' }
])(
  'resizes $direction panels from the keyboard within their limits',
  async ({ direction, key }) => {
    const onLayout = vi.fn()
    render({
      components: { SplitterGroup, SplitterPanel, SplitterResizeHandle },
      setup: () => ({ direction, onLayout }),
      template: `
      <SplitterGroup :direction="direction" @layout="onLayout">
        <SplitterPanel :default-size="40" :min-size="30" :max-size="60">First</SplitterPanel>
        <SplitterResizeHandle aria-label="Resize panels" />
        <SplitterPanel :default-size="60">Second</SplitterPanel>
      </SplitterGroup>
    `
    })
    const handle = await screen.findByRole('separator', {
      name: 'Resize panels'
    })
    await waitFor(() => expect(handle).toHaveAttribute('aria-valuenow', '40'))
    handle.focus()
    await userEvent.keyboard(key)
    expect(handle).toHaveAttribute('aria-valuenow', '50')
    expect(onLayout).toHaveBeenLastCalledWith([50, 50])
    await userEvent.keyboard('{End}')
    expect(handle).toHaveAttribute('aria-valuenow', '60')
    expect(onLayout).toHaveBeenLastCalledWith([60, 40])
    await userEvent.keyboard('{Home}')
    expect(handle).toHaveAttribute('aria-valuenow', '30')
    expect(onLayout).toHaveBeenLastCalledWith([30, 70])
  }
)
