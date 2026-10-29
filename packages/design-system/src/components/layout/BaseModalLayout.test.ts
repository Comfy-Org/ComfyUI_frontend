import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'

import BaseModalLayout from './BaseModalLayout.vue'

function renderLayout(props: Record<string, unknown> = {}) {
  return render(BaseModalLayout, {
    props: {
      contentTitle: 'Title',
      labels: {
        showLeftPanel: 'Show left panel',
        hideLeftPanel: 'Hide left panel',
        showRightPanel: 'Show right panel',
        hideRightPanel: 'Hide right panel',
        close: 'Close dialog'
      },
      ...props
    },
    slots: { header: () => h('div', 'header') }
  })
}

const closeButton = () => screen.getByRole('button', { name: 'Close dialog' })

describe('BaseModalLayout close button', () => {
  it('renders the secondary variant by default', () => {
    renderLayout()

    expect(closeButton()).toHaveClass('bg-secondary')
  })

  it('applies the supplied close button variant', () => {
    renderLayout({ closeButtonVariant: 'textonly' })

    const button = closeButton()
    expect(button).toHaveClass('bg-transparent')
    expect(button).not.toHaveClass('bg-secondary')
  })

  it('uses the Lucide close icon unless a dialog supplies one', () => {
    renderLayout()

    expect(closeButton()).toContainHTML('icon-[lucide--x]')
  })

  it('renders the supplied close icon', () => {
    renderLayout({ closeIcon: 'icon-[lucide--x] size-4' })

    expect(closeButton()).toContainHTML('icon-[lucide--x]')
  })

  it('emits close when the close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderLayout({ onClose })

    await user.click(closeButton())

    expect(onClose).toHaveBeenCalledOnce()
  })
})
