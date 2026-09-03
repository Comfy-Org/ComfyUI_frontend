import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'

import PopoverOverlay from './PopoverOverlay.vue'

describe('PopoverOverlay', () => {
  it('closes when an anchor ancestor scrolls', async () => {
    const popover = ref<InstanceType<typeof PopoverOverlay>>()
    render(
      defineComponent({
        components: { PopoverOverlay },
        setup: () => ({ popover }),
        template: `
          <div data-testid="scroller">
            <button>Open</button>
          </div>
          <PopoverOverlay ref="popover">Popover content</PopoverOverlay>
        `
      })
    )
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const trigger = screen.getByRole('button', { name: 'Open' })

    await user.click(trigger)
    popover.value?.show(new Event('show'), trigger)
    expect(await screen.findByText('Popover content')).toBeVisible()

    await fireEvent.scroll(screen.getByTestId('scroller'))

    await waitFor(() =>
      expect(screen.queryByText('Popover content')).not.toBeInTheDocument()
    )
  })
})
