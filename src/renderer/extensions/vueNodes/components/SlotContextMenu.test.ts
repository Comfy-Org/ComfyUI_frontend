import userEvent from '@testing-library/user-event'
import { cleanup, render, screen, waitFor } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import type { Ref } from 'vue'
import { nextTick } from 'vue'
import { afterEach, assert, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { INodeOutputSlot } from '@/lib/litegraph/src/interfaces'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { FindCompatibleTargets } from '@/renderer/extensions/vueNodes/composables/useSlotContextMenu'
import { toNodeId } from '@/types/nodeId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

const {
  canvasTransform,
  registerSlotMenuInstance,
  findCompatibleTargets,
  canRenameSlot,
  connectSlots,
  renameSlot
} = vi.hoisted(() => ({
  canvasTransform: { scale: 1, offset: [0, 0] as [number, number] },
  registerSlotMenuInstance: vi.fn(),
  findCompatibleTargets: vi.fn<FindCompatibleTargets>(() => []),
  canRenameSlot: vi.fn(() => false),
  connectSlots: vi.fn(),
  renameSlot: vi.fn()
}))

vi.mock(
  import('@/renderer/extensions/vueNodes/composables/useSlotContextMenu'),
  () => ({
    canRenameSlot,
    connectSlots,
    findCompatibleTargets,
    registerSlotMenuInstance,
    renameSlot
  })
)

import SlotContextMenu from './SlotContextMenu.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        renameSlot: 'Rename slot',
        newSlotLabel: 'New slot label:',
        noCompatibleNodes: 'No compatible nodes',
        connectTo: 'Connect to...'
      }
    }
  }
})

function renderMenu() {
  vi.mocked(useCanvasStore().getCanvas).mockReturnValue(
    fromPartial({
      canvas: document.createElement('canvas'),
      ds: canvasTransform
    })
  )
  return render(SlotContextMenu, { global: { plugins: [i18n] } })
}

describe('SlotContextMenu', () => {
  afterEach(() => {
    cleanup()
    canvasTransform.scale = 1
    canvasTransform.offset = [0, 0]
  })

  it('opens at the requested canvas position and closes imperatively', async () => {
    renderMenu()
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

  it('keeps the popup anchor out of ordinary pointer hit testing', () => {
    renderMenu()

    expect(screen.getByTestId('slot-context-menu-anchor')).toHaveStyle({
      pointerEvents: 'none'
    })
  })

  it('moves the rendered popup when the canvas camera changes', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        const left = Number.parseFloat(this.style.left) || 0
        const top = Number.parseFloat(this.style.top) || 0
        return new DOMRect(left, top, 1, 1)
      }
    )
    renderMenu()
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
    renderMenu()
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
    const targetNode = createMockLGraphNode({
      title: 'Target node',
      type: 'TargetType'
    })
    const target = {
      node: targetNode,
      slotIndex: 1,
      slotInfo: fromPartial<INodeOutputSlot>({ name: 'image', type: 'IMAGE' })
    }
    findCompatibleTargets.mockReturnValue([target])
    const user = userEvent.setup()
    renderMenu()
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
    const { unmount } = renderMenu()
    expect(registerSlotMenuInstance).toHaveBeenCalledOnce()

    unmount()
    expect(registerSlotMenuInstance).toHaveBeenLastCalledWith(null)
  })
})
