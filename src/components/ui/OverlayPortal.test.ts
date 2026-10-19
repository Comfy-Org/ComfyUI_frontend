import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { ConfigProvider } from 'reka-ui'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import OverlayPortal from '@comfyorg/design-system/OverlayPortal'

describe('OverlayPortal', () => {
  it('raises retained content on reopen without losing its value and removes it on unmount', async () => {
    const open = ref(true)
    const { unmount } = render({
      components: { OverlayPortal },
      setup: () => ({ open }),
      template: `
        <OverlayPortal :open force-mount>
          <input v-show="open" aria-label="Draft" />
        </OverlayPortal>
      `
    })
    const input = await screen.findByRole('textbox', { name: 'Draft' })
    await userEvent.setup().type(input, 'Keep my draft')
    open.value = false
    await waitFor(() => expect(input).not.toBeVisible())
    render({
      template:
        '<section class="fixed z-overlay" data-testid="existing-overlay" />'
    })
    const later = screen.getByTestId('existing-overlay')
    open.value = true
    await waitFor(() => expect(input).toBeVisible())

    expect(later.compareDocumentPosition(input)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
    expect(input).toHaveValue('Keep my draft')
    unmount()
    expect(input).not.toBeInTheDocument()
  })

  it.for([false, true])(
    'honors an explicit target with disabled=%s',
    async (disabled) => {
      const target = render({ template: '<section aria-label="Target" />' })
      const destination = screen.getByRole('region', { name: 'Target' })
      const { container, unmount } = render({
        components: { ConfigProvider, OverlayPortal },
        setup: () => ({ destination, disabled }),
        template: `
        <ConfigProvider teleport-to="body">
          <OverlayPortal open :to="destination" :disabled>
            <button>Action</button>
          </OverlayPortal>
        </ConfigProvider>
      `
      })
      const button = await screen.findByRole('button', { name: 'Action' })
      expect(disabled ? container : destination).toContainElement(button)
      unmount()
      expect(button).not.toBeInTheDocument()
      target.unmount()
    }
  )
})
