import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { MenuOption } from '@/composables/graph/useMoreOptionsMenu'

import NodeContextMenu from './NodeContextMenu.vue'

const { registeredInstance } = vi.hoisted(() => ({
  registeredInstance: {
    value: null as null | { show: (event: MouseEvent) => void }
  }
}))

vi.mock('@/composables/graph/useMoreOptionsMenu', () => ({
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

vi.mock('@/composables/graph/useNodeCustomization', () => ({
  useNodeCustomization: () => ({ getCurrentShape: vi.fn() })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    getCanvas: () => ({
      canvas: document.createElement('canvas'),
      ds: { scale: 1, offset: [0, 0] }
    })
  })
}))

describe('NodeContextMenu', () => {
  beforeEach(() => {
    registeredInstance.value = null
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
