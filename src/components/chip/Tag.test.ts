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
    interactive?: boolean
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

  it('gives interactive tags button semantics and keyboard focus', () => {
    renderTag({ label: 'Open workflow', interactive: true })

    expect(
      screen.getByRole('button', { name: 'Open workflow' })
    ).toHaveAttribute('tabindex', '0')
  })

  it('emits remove event when remove button is clicked', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    renderTag({ label: 'Test', removable: true, onRemove })

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onRemove).toHaveBeenCalledOnce()
  })

  it.for(['{Enter}', ' '])(
    'removes an interactive tag with the remove button using %s',
    async (key) => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      const onRemove = vi.fn()
      render(Tag, {
        props: {
          label: 'Test',
          interactive: true,
          removable: true,
          onRemove
        },
        attrs: { role: 'button', tabindex: 0, onClick },
        global: { plugins: [i18n] }
      })
      const removeButton = screen.getByRole('button', { name: 'Remove' })

      removeButton.focus()
      await user.keyboard(key)

      expect(onRemove).toHaveBeenCalledOnce()
      expect(onClick).not.toHaveBeenCalled()
    }
  )

  it('uses a context-specific remove label', () => {
    render(Tag, {
      props: {
        label: 'KSampler',
        removable: true,
        removeLabel: 'Remove KSampler reference'
      },
      global: { plugins: [i18n] }
    })

    expect(
      screen.getByRole('button', { name: 'Remove KSampler reference' })
    ).toBeInTheDocument()
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
