import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'
import GraphCanvasMenu from '@/components/graph/GraphCanvasMenu.vue'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      graphCanvasMenu: {
        canvasToolbar: 'Canvas toolbar',
        fitView: 'Fit view',
        showLinks: 'Show links',
        hideLinks: 'Hide links'
      },
      zoomControls: {
        label: 'Zoom controls',
        showMinimap: 'Show minimap',
        hideMinimap: 'Hide minimap'
      }
    }
  }
})

const MenuUnderTooltipProvider = defineComponent({
  setup: () => () => h(TooltipProvider, () => h(GraphCanvasMenu))
})

function renderMenu() {
  render(MenuUnderTooltipProvider, {
    global: {
      plugins: [i18n],
      stubs: { CanvasModeSelector: true, ZoomControlsModal: true }
    }
  })
}

function textNodeWith(root: HTMLElement, text: string) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    if (walker.currentNode.nodeValue === text) return walker.currentNode
  }
  throw new Error(`No text node "${text}"`)
}

beforeEach(() => {
  vi.mocked(useCommandStore().formatKeySequence).mockReturnValue('')
})

describe('GraphCanvasMenu', () => {
  it('shows the canvas scale as a percentage', async () => {
    useCanvasStore().appScalePercentage = 60
    renderMenu()

    expect(
      screen.getByRole('button', { name: 'Zoom controls' })
    ).toHaveTextContent('60%')
  })

  it('updates the zoom percentage inside its existing text node', async () => {
    useCanvasStore().appScalePercentage = 100
    renderMenu()
    const zoomButton = screen.getByRole('button', { name: 'Zoom controls' })
    const digits = textNodeWith(zoomButton, '100')

    useCanvasStore().appScalePercentage = 250
    await nextTick()

    expect(zoomButton).toHaveTextContent('250%')
    expect(digits.nodeValue).toBe('250')
    expect(digits.isConnected).toBe(true)
  })
})
