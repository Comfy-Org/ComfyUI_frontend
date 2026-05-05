import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import NotificationPopup from './NotificationPopup.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: { g: { close: 'Close' } }
  }
})

function renderPopup(
  props: { title: string; [key: string]: unknown } = { title: 'Test' },
  slots: Record<string, string> = {}
) {
  return render(NotificationPopup, {
    global: { plugins: [i18n] },
    props,
    slots
  })
}

describe('NotificationPopup', () => {
  it('renders title', () => {
    renderPopup({ title: 'Hello World' })
    expect(screen.getByRole('status')).toHaveTextContent('Hello World')
  })

  it('has role="status" for accessibility', () => {
    renderPopup()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    renderPopup({ title: 'T', subtitle: 'v1.2.3' })
    expect(screen.getByRole('status')).toHaveTextContent('v1.2.3')
  })

  it('renders icon when provided', () => {
    const { container } = renderPopup({
      title: 'T',
      icon: 'icon-[lucide--rocket]'
    })
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const icon = container.querySelector('i.icon-\\[lucide--rocket\\]')
    expect(icon).toBeInTheDocument()
  })

  it('emits close when close button clicked', async () => {
    const user = userEvent.setup()
    const closeSpy = vi.fn()
    renderPopup({ title: 'T', showClose: true, onClose: closeSpy })
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(closeSpy).toHaveBeenCalledOnce()
  })

  it('renders default slot content', () => {
    renderPopup({ title: 'T' }, { default: 'Body text here' })
    expect(screen.getByRole('status')).toHaveTextContent('Body text here')
  })

  it('renders footer slots', () => {
    renderPopup(
      { title: 'T' },
      { 'footer-start': 'Left side', 'footer-end': 'Right side' }
    )
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Left side')
    expect(status).toHaveTextContent('Right side')
  })

  it('positions bottom-right when specified', () => {
    renderPopup({ title: 'T', position: 'bottom-right' })
    expect(screen.getByRole('status')).toHaveAttribute(
      'data-position',
      'bottom-right'
    )
  })
})
