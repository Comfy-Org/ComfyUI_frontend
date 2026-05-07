import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import SearchFilterChip from './SearchFilterChip.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { remove: 'Remove' } } }
})

function renderChip(
  props: { text: string; badge: string; badgeClass: string },
  onRemove?: (...args: unknown[]) => void
) {
  return render(SearchFilterChip, {
    props: { ...props, ...(onRemove ? { onRemove } : {}) },
    global: { plugins: [i18n] }
  })
}

describe('SearchFilterChip', () => {
  it('renders badge and text', () => {
    renderChip({ text: 'MODEL', badge: 'I', badgeClass: 'i-badge' })
    expect(screen.getByText('MODEL')).toBeInTheDocument()
    expect(screen.getByText('I')).toBeInTheDocument()
  })

  it.each([
    ['input type', 'I', 'i-badge', 'bg-green-500'],
    ['output type', 'O', 'o-badge', 'bg-red-500'],
    ['combo type', 'C', 'c-badge', 'bg-blue-500'],
    ['seed type', 'S', 's-badge', 'bg-yellow-500']
  ])(
    'applies semantic badge class for %s',
    (_, badgeText, badgeClass, color) => {
      renderChip({ text: 'CLIP', badge: badgeText, badgeClass })
      const badge = screen.getByText(badgeText)
      expect(badge.className).toContain(color)
    }
  )

  it('shows remove button and emits remove on click', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    renderChip({ text: 'MODEL', badge: 'I', badgeClass: 'i-badge' }, onRemove)

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onRemove).toHaveBeenCalledOnce()
  })

  it('falls back to raw badgeClass when no semantic mapping', () => {
    renderChip({
      text: 'CUSTOM',
      badge: 'X',
      badgeClass: 'custom-class'
    })
    const badge = screen.getByText('X')
    expect(badge.className).toContain('custom-class')
  })
})
