import { cleanup, render, screen } from '@testing-library/vue'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { toNodeId } from '@/types/nodeId'

const { registerSlotMenuInstance, findCompatibleTargets } = vi.hoisted(() => ({
  registerSlotMenuInstance: vi.fn(),
  findCompatibleTargets: vi.fn(() => [])
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    getCanvas: () => ({
      canvas: document.createElement('canvas'),
      ds: { scale: 1, offset: [0, 0] }
    })
  })
}))

vi.mock(
  '@/renderer/extensions/vueNodes/composables/useSlotContextMenu',
  () => ({
    canRenameSlot: vi.fn(() => false),
    connectSlots: vi.fn(),
    findCompatibleTargets,
    registerSlotMenuInstance,
    renameSlot: vi.fn()
  })
)

import SlotContextMenu from './SlotContextMenu.vue'

describe('SlotContextMenu', () => {
  afterEach(() => {
    cleanup()
  })

  it('opens at the requested canvas position and closes imperatively', async () => {
    render(SlotContextMenu)
    const menu = registerSlotMenuInstance.mock.calls[0][0] as {
      show: (event: MouseEvent, context: object) => Promise<void>
      hide: () => void
    }

    await menu.show(
      new MouseEvent('contextmenu', { clientX: 40, clientY: 60 }),
      {
        nodeId: toNodeId('1'),
        slotIndex: 0,
        isInput: true
      }
    )
    await nextTick()

    expect(screen.getByText('No compatible nodes')).toBeInTheDocument()
    expect(screen.getByTestId('slot-context-menu-anchor')).toHaveStyle({
      left: '40px',
      top: '60px'
    })

    menu.hide()
    await nextTick()
    expect(screen.queryByText('No compatible nodes')).not.toBeInTheDocument()
  })

  it('unregisters its imperative interface when unmounted', () => {
    const { unmount } = render(SlotContextMenu)
    expect(registerSlotMenuInstance).toHaveBeenCalledOnce()

    unmount()
    expect(registerSlotMenuInstance).toHaveBeenLastCalledWith(null)
  })
})
