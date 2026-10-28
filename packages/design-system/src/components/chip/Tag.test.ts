import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import type { ComponentProps } from 'vue-component-type-helpers'

import Tag from './Tag.vue'

function renderTag(
  props: ComponentProps<typeof Tag>,
  options?: { slots?: Record<string, string> }
) {
  return render(Tag, {
    props,
    ...options
  })
}

describe('Tag', () => {
  it('renders label text', () => {
    renderTag({ label: 'JavaScript' })
    expect(screen.getByText('JavaScript')).toBeInTheDocument()
  })

  it('requires a remove label only when removable', () => {
    type Props = InstanceType<typeof Tag>['$props']

    expectTypeOf<{ label: string }>().toExtend<Props>()
    expectTypeOf<{ label: string; removeLabel: string }>().toExtend<Props>()
    expectTypeOf<{
      label: string
      removable: true
      removeLabel: string
    }>().toExtend<Props>()
    expectTypeOf<{ label: string; removable: true }>().not.toExtend<Props>()
  })

  it.for([
    { name: 'by default', props: { label: 'Test' } },
    {
      name: 'when only removeLabel is set',
      props: { label: 'Test', removeLabel: 'Remove' }
    }
  ])('does not show a remove button $name', ({ props }) => {
    renderTag(props)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows a remove button named by removeLabel when removable', () => {
    renderTag({ label: 'Test', removable: true, removeLabel: 'Remove' })
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
    renderTag({
      label: 'Test',
      removable: true,
      removeLabel: 'Remove',
      onRemove
    })

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
          removeLabel: 'Remove',
          onRemove
        },
        attrs: { role: 'button', tabindex: 0, onClick }
      })
      const removeButton = screen.getByRole('button', { name: 'Remove' })

      removeButton.focus()
      await user.keyboard(key)

      expect(onRemove).toHaveBeenCalledOnce()
      expect(onClick).not.toHaveBeenCalled()
    }
  )

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
