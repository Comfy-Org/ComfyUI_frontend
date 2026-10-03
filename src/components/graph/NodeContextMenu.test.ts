import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import type { MenuOption } from '@/composables/graph/useMoreOptionsMenu'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import NodeContextMenu from './NodeContextMenu.vue'

const { menuOptions, registeredInstance } = vi.hoisted<{
  menuOptions: { value: MenuOption[] }
  registeredInstance: {
    value: null | {
      show: (event: MouseEvent) => void
      toggle: (event: MouseEvent) => void
    }
  }
}>(() => ({
  menuOptions: { value: [] },
  registeredInstance: { value: null }
}))

vi.mock<unknown>(import('@/composables/graph/useMoreOptionsMenu'), () => {
  const reactiveMenuOptions = reactive(menuOptions)
  return {
    registerNodeOptionsInstance: (
      instance: null | {
        show: (event: MouseEvent) => void
        toggle: (event: MouseEvent) => void
      }
    ) => {
      registeredInstance.value = instance
    },
    useMoreOptionsMenu: () => ({
      bump: () => {
        reactiveMenuOptions.value = [{ label: 'Refreshed', action: vi.fn() }]
      },
      menuOptions: reactiveMenuOptions
    })
  }
})

vi.mock<unknown>(import('@/composables/graph/useNodeCustomization'), () => ({
  useNodeCustomization: () => ({ getCurrentShape: vi.fn() })
}))

describe('NodeContextMenu', () => {
  beforeEach(() => {
    registeredInstance.value = null
    menuOptions.value = [{ label: 'Inspect', action: vi.fn() }]
    useCanvasStore().canvas = fromPartial({
      canvas: document.createElement('canvas'),
      ds: { scale: 1, offset: [0, 0] }
    })
  })

  it('opens through the registered instance', async () => {
    render(NodeContextMenu)
    const event = new PointerEvent('contextmenu', {
      bubbles: true,
      button: 2,
      clientX: 100,
      clientY: 120
    })

    registeredInstance.value?.show(event)

    expect(await screen.findByRole('menu')).toBeVisible()
  })

  it('refreshes options when toggled open', async () => {
    render(NodeContextMenu)
    const event = new MouseEvent('click', {
      bubbles: true,
      clientX: 100,
      clientY: 120
    })

    registeredInstance.value?.toggle(event)

    expect(await screen.findByRole('menu')).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Refreshed' })).toBeVisible()
  })
})
