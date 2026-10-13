import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import { usePragmaticDroppable } from '@/composables/usePragmaticDragAndDrop'

vi.mock(import('@atlaskit/pragmatic-drag-and-drop/element/adapter'))

const DropSurface = defineComponent({
  setup() {
    const target = ref<HTMLElement | null>(null)
    const visible = ref(false)
    const version = ref(0)
    usePragmaticDroppable(target, {})
    return () =>
      h('div', [
        h(
          'button',
          {
            onClick: () => {
              visible.value = true
            }
          },
          'Show target'
        ),
        h(
          'button',
          {
            onClick: () => {
              visible.value = false
            }
          },
          'Hide target'
        ),
        h(
          'button',
          {
            onClick: () => {
              version.value++
            }
          },
          'Replace target'
        ),
        visible.value
          ? h('div', {
              ref: target,
              key: version.value,
              role: 'region',
              'aria-label': 'Drop surface'
            })
          : null
      ])
  }
})

describe('usePragmaticDroppable', () => {
  it('registers a target that appears after the component mounts', async () => {
    const user = userEvent.setup()
    vi.mocked(dropTargetForElements).mockReturnValue(vi.fn())
    render(DropSurface)
    expect(dropTargetForElements).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Show target' }))

    expect(dropTargetForElements).toHaveBeenCalledExactlyOnceWith({
      element: screen.getByRole('region', { name: 'Drop surface' })
    })
  })

  it('releases replaced and removed targets and stops the last target on unmount', async () => {
    const user = userEvent.setup()
    const firstCleanup = vi.fn()
    const secondCleanup = vi.fn()
    const thirdCleanup = vi.fn()
    vi.mocked(dropTargetForElements)
      .mockReturnValueOnce(firstCleanup)
      .mockReturnValueOnce(secondCleanup)
      .mockReturnValueOnce(thirdCleanup)
    const view = render(DropSurface)
    await user.click(screen.getByRole('button', { name: 'Show target' }))
    await user.click(screen.getByRole('button', { name: 'Replace target' }))
    expect(firstCleanup).toHaveBeenCalledOnce()
    expect(dropTargetForElements).toHaveBeenCalledTimes(2)

    await user.click(screen.getByRole('button', { name: 'Hide target' }))
    expect(secondCleanup).toHaveBeenCalledOnce()
    expect(dropTargetForElements).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: 'Show target' }))
    expect(dropTargetForElements).toHaveBeenCalledTimes(3)
    expect(thirdCleanup).not.toHaveBeenCalled()

    view.unmount()

    expect(thirdCleanup).toHaveBeenCalledOnce()
  })
})
