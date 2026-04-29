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

  it('applies semantic badge class for input type', () => {
    renderChip({ text: 'CLIP', badge: 'I', badgeClass: 'i-badge' })
    const badge = screen.getByText('I')
    expect(badge.className).toContain('bg-green-500')
  })

  it('applies semantic badge class for output type', () => {
    renderChip({ text: 'IMAGE', badge: 'O', badgeClass: 'o-badge' })
    const badge = screen.getByText('O')
    expect(badge.className).toContain('bg-red-500')
  })

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
