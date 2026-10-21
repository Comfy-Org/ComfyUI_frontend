import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import PopoverContent from './PopoverContent.vue'

describe('PopoverContent', () => {
  it('reopens after a later overlay in document order', async () => {
    const open = ref(false)
    render({
      components: { PopoverContent, PopoverRoot, PopoverTrigger },
      setup: () => ({ open }),
      template: `
        <PopoverRoot v-model:open="open">
          <PopoverTrigger>Toggle</PopoverTrigger>
          <PopoverContent>Content</PopoverContent>
        </PopoverRoot>
      `
    })
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const trigger = screen.getByRole('button', { name: 'Toggle' })

    await user.tab()
    expect(trigger).toHaveFocus()
    open.value = true
    expect(await screen.findByRole('dialog')).toBeVisible()
    open.value = false
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    render({
      template:
        '<section class="fixed z-overlay" data-testid="existing-overlay" />'
    })

    const laterDialog = screen.getByTestId('existing-overlay')
    open.value = true

    const reopenedContent = await screen.findByRole('dialog')
    expect(laterDialog.compareDocumentPosition(reopenedContent)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })
})
