import userEvent from '@testing-library/user-event'
import { cleanup, render, screen, waitFor } from '@testing-library/vue'
import type { Ref } from 'vue'
import { nextTick } from 'vue'
import { afterEach, assert, describe, expect, it, vi } from 'vitest'

import { toNodeId } from '@/types/nodeId'

const {
  canvasTransform,
  registerSlotMenuInstance,
  findCompatibleTargets,
  canRenameSlot,
  connectSlots,
  renameSlot
} = vi.hoisted(() => ({
  canvasTransform: { scale: 1, offset: [0, 0] },
  registerSlotMenuInstance: vi.fn(),
  findCompatibleTargets: vi.fn(() => []),
  canRenameSlot: vi.fn(() => false),
  connectSlots: vi.fn(),
  renameSlot: vi.fn()
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    getCanvas: () => ({
      canvas: document.createElement('canvas'),
      ds: canvasTransform
    })
  })
}))

vi.mock(
  '@/renderer/extensions/vueNodes/composables/useSlotContextMenu',
  () => ({
    canRenameSlot,
    connectSlots,
    findCompatibleTargets,
    registerSlotMenuInstance,
    renameSlot
  })
)

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        'g.renameSlot': 'Rename slot',
        'g.newSlotLabel': 'New slot label:',
        'g.noCompatibleNodes': 'No compatible nodes',
        'g.connectTo': 'Connect to...'
      })[key]
  })
}))

import SlotContextMenu from './SlotContextMenu.vue'

describe('SlotContextMenu', () => {
  afterEach(() => {
    cleanup()
    canvasTransform.scale = 1
    canvasTransform.offset = [0, 0]
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

  it('moves the rendered popup when the canvas camera changes', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function () {
        const left = Number.parseFloat(this.style.left) || 0
        const top = Number.parseFloat(this.style.top) || 0
        return new DOMRect(left, top, 1, 1)
      }
    )
    render(SlotContextMenu)
    const menu = registerSlotMenuInstance.mock.calls[0][0] as {
      show: (event: MouseEvent, context: object) => Promise<void>
    }

    await menu.show(
      new MouseEvent('contextmenu', { clientX: 40, clientY: 60 }),
      { nodeId: toNodeId('1'), slotIndex: 0, isInput: true }
    )
    const popup = await screen.findByRole('menu')
    const positionedPopup: unknown = Reflect.get(popup, 'parentElement')
    assert(positionedPopup instanceof HTMLElement)
    await waitFor(() => {
      expect(positionedPopup.style.transform).toBe('translate(38px, 60px)')
    })

    canvasTransform.offset = [20, 30]
    window.dispatchEvent(new Event('resize'))

    await waitFor(() => {
      expect(positionedPopup.style.transform).toBe('translate(58px, 90px)')
    })
  })

  it('renames a slot and closes the popup', async () => {
    canRenameSlot.mockReturnValue(true)
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'renamed')
    )
    const user = userEvent.setup()
    render(SlotContextMenu)
    const menu = registerSlotMenuInstance.mock.calls[0][0] as {
      show: (event: MouseEvent, context: object) => Promise<void>
      isOpen: Ref<boolean>
    }
    const context = { nodeId: toNodeId('1'), slotIndex: 0, isInput: true }

    await menu.show(new MouseEvent('contextmenu'), context)
    await user.click(await screen.findByText('Rename slot'))

    expect(renameSlot).toHaveBeenCalledWith(context, 'renamed')
    expect(menu.isOpen.value).toBe(false)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('quick-connects to a compatible slot and closes the popup', async () => {
    const target = {
      node: { title: 'Target node', type: 'TargetType' },
      slotIndex: 1,
      slotInfo: { name: 'image' }
    }
    findCompatibleTargets.mockReturnValue([target])
    const user = userEvent.setup()
    render(SlotContextMenu)
    const menu = registerSlotMenuInstance.mock.calls[0][0] as {
      show: (event: MouseEvent, context: object) => Promise<void>
      isOpen: Ref<boolean>
    }
    const context = { nodeId: toNodeId('1'), slotIndex: 0, isInput: false }

    await menu.show(new MouseEvent('contextmenu'), context)
    await user.click(await screen.findByText('image @ Target node'))

    expect(connectSlots).toHaveBeenCalledWith(context, target)
    expect(menu.isOpen.value).toBe(false)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('unregisters its imperative interface when unmounted', () => {
    const { unmount } = render(SlotContextMenu)
    expect(registerSlotMenuInstance).toHaveBeenCalledOnce()

    unmount()
    expect(registerSlotMenuInstance).toHaveBeenLastCalledWith(null)
  })
})
