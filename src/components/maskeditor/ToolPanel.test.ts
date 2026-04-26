import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { useToolManager } from '@/composables/maskeditor/useToolManager'

import ToolPanel from '@/components/maskeditor/ToolPanel.vue'
import { Tools, allTools } from '@/extensions/core/maskeditor/types'

type ToolManager = ReturnType<typeof useToolManager>

vi.mock('@/extensions/core/maskeditor/constants', () => ({
  iconsHtml: {
    pen: '<svg data-testid="icon-pen" />',
    rgbPaint: '<svg data-testid="icon-rgbPaint" />',
    eraser: '<svg data-testid="icon-eraser" />',
    paintBucket: '<svg data-testid="icon-paintBucket" />',
    colorSelect: '<svg data-testid="icon-colorSelect" />'
  }
}))

const initialMock = () =>
  reactive({
    currentTool: Tools.MaskPen as Tools,
    displayZoomRatio: 1,
    image: null as { width: number; height: number } | null,
    resetZoom: vi.fn()
  })

let mockStore: ReturnType<typeof initialMock>

vi.mock('@/stores/maskEditorStore', () => ({
  useMaskEditorStore: () => mockStore
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      maskEditor: {
        clickToResetZoom: 'Click to reset zoom'
      }
    }
  }
})

const mockToolManager = vi.hoisted(() => ({
  switchTool: vi.fn()
}))

const renderPanel = () =>
  render(ToolPanel, {
    global: { plugins: [i18n] },
    props: { toolManager: mockToolManager as unknown as ToolManager }
  })

const getToolButton = (tool: Tools): HTMLElement => {
  const btns = screen.getAllByTestId('tool-button')
  const match = btns.find((b) => b.dataset.tool === tool)
  if (!match) throw new Error(`tool button for "${tool}" not found`)
  return match
}

describe('ToolPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore = initialMock()
  })

  describe('tool list rendering', () => {
    it('should render one button per tool in allTools', () => {
      renderPanel()
      expect(screen.getAllByTestId('tool-button')).toHaveLength(allTools.length)
    })

    it('should render the icon HTML for each tool', () => {
      renderPanel()
      for (const tool of allTools) {
        expect(screen.getByTestId(`icon-${tool}`)).toBeInTheDocument()
      }
    })
  })

  describe('current tool highlight', () => {
    it.each([Tools.MaskPen, Tools.Eraser, Tools.PaintPen] as const)(
      'should mark the %s button as selected when it is the current tool',
      (tool) => {
        mockStore.currentTool = tool
        renderPanel()

        expect(getToolButton(tool).className).toContain(
          'maskEditor_toolPanelContainerSelected'
        )
      }
    )

    it('should not mark non-current tools as selected', () => {
      mockStore.currentTool = Tools.MaskPen
      renderPanel()

      for (const tool of allTools) {
        if (tool === Tools.MaskPen) continue
        expect(getToolButton(tool).className).not.toContain(
          'maskEditor_toolPanelContainerSelected'
        )
      }
    })
  })

  describe('tool selection', () => {
    it('should call toolManager.switchTool with the clicked tool', async () => {
      const user = userEvent.setup()
      renderPanel()

      await user.click(getToolButton(Tools.Eraser))

      expect(mockToolManager.switchTool).toHaveBeenCalledWith(Tools.Eraser)
    })
  })

  describe('zoom indicator', () => {
    it('should render rounded zoom percentage from displayZoomRatio', () => {
      mockStore.displayZoomRatio = 1.236
      renderPanel()

      expect(screen.getByTestId('zoom-percentage').textContent).toBe('124%')
    })

    it('should render image dimensions when an image is loaded', () => {
      mockStore.image = { width: 800, height: 600 }
      renderPanel()

      expect(screen.getByTestId('zoom-dimensions').textContent).toBe('800x600')
    })

    it('should render a single space placeholder when no image', () => {
      mockStore.image = null
      renderPanel()

      expect(screen.getByTestId('zoom-dimensions').textContent?.trim()).toBe('')
    })

    it('should call resetZoom when the zoom indicator is clicked', async () => {
      const user = userEvent.setup()
      renderPanel()

      await user.click(screen.getByTestId('zoom-percentage'))

      expect(mockStore.resetZoom).toHaveBeenCalledTimes(1)
    })
  })
})
