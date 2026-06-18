import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import Tag from './Tag.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { remove: 'Remove' } } }
})

function renderTag(
  props: {
    label: string
    shape?: 'square' | 'rounded'
    removable?: boolean
    onRemove?: (...args: unknown[]) => void
  },
  options?: { slots?: Record<string, string> }
) {
  return render(Tag, {
    props,
    global: { plugins: [i18n] },
    ...options
  })
}

describe('Tag', () => {
  it('renders label text', () => {
    renderTag({ label: 'JavaScript' })
    expect(screen.getByText('JavaScript')).toBeInTheDocument()
  })

  it('does not show remove button by default', () => {
    renderTag({ label: 'Test' })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows remove button when removable', () => {
    renderTag({ label: 'Test', removable: true })
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  it('emits remove event when remove button is clicked', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    renderTag({ label: 'Test', removable: true, onRemove })

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onRemove).toHaveBeenCalledOnce()
  })

  it('renders icon slot content', () => {
    renderTag(
      { label: 'LoRA' },
      {
        slots: {
          icon: '<i data-testid="tag-icon" class="icon-[lucide--folder]" />'
        }
      }
    )
    expect(screen.getByTestId('tag-icon')).toBeInTheDocument()
  })
})
