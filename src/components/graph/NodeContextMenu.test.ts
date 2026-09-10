import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { MenuOption } from '@/composables/graph/useMoreOptionsMenu'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import NodeContextMenu from './NodeContextMenu.vue'

const { registeredInstance } = vi.hoisted(() => ({
  registeredInstance: {
    value: null as null | { show: (event: MouseEvent) => void }
  }
}))

vi.mock<unknown>(import('@/composables/graph/useMoreOptionsMenu'), () => ({
  registerNodeOptionsInstance: (
    instance: null | { show: (event: MouseEvent) => void }
  ) => {
    registeredInstance.value = instance
  },
  useMoreOptionsMenu: () => ({
    bump: vi.fn(),
    menuOptions: ref<MenuOption[]>([{ label: 'Inspect', action: vi.fn() }])
  })
}))

vi.mock<unknown>(import('@/composables/graph/useNodeCustomization'), () => ({
  useNodeCustomization: () => ({ getCurrentShape: vi.fn() })
}))

describe('NodeContextMenu', () => {
  beforeEach(() => {
    registeredInstance.value = null
    useCanvasStore().canvas = fromPartial({
      canvas: document.createElement('canvas'),
      ds: { scale: 1, offset: [0, 0] }
    })
  })

  it('opens for a widget pointer context-menu event', async () => {
    render(NodeContextMenu)
    const widget = document.createElement('button')
    document.body.append(widget)
    widget.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      event.stopPropagation()
      registeredInstance.value?.show(event)
    })
    const event = new PointerEvent('contextmenu', {
      bubbles: true,
      button: 2,
      clientX: 100,
      clientY: 120
    })

    widget.dispatchEvent(event)

    expect(await screen.findByRole('menu')).toBeVisible()
    widget.remove()
  })
})
