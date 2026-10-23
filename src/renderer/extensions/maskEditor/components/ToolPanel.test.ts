import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ToolPanel from '@/renderer/extensions/maskEditor/components/ToolPanel.vue'
import type { useToolManager } from '@comfyorg/mask-editor/useToolManager'
import { Tools, allTools } from '@comfyorg/mask-editor/types'
import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'

type ToolManager = ReturnType<typeof useToolManager>

let mockStore: ReturnType<typeof useMaskEditorStore>

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      maskEditor: {
        clickToResetZoom: 'Click to reset zoom',
        colorSelector: 'Color Selector',
        toolPen: 'Pen',
        toolPaintPen: 'Paint pen',
        toolEraser: 'Eraser',
        toolPaintBucket: 'Paint bucket',
        toolColorSelect: 'Color select'
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

const getToolButton = (name: string): HTMLElement =>
  screen.getByRole('button', { name })

describe('ToolPanel', () => {
  beforeEach(() => {
    mockStore = useMaskEditorStore()
    mockStore.$patch({
      currentTool: Tools.MaskPen,
      displayZoomRatio: 1,
      image: null,
      rgbColor: '#ff0000',
      colorInput: null
    })
  })

  describe('tool list rendering', () => {
    it('should render one named button per tool', () => {
      renderPanel()

      for (const name of [
        'Pen',
        'Paint pen',
        'Eraser',
        'Paint bucket',
        'Color select'
      ]) {
        expect(getToolButton(name)).toBeInTheDocument()
      }
      expect(screen.getAllByTestId('tool-button')).toHaveLength(allTools.length)
    })

    it('should render an SVG icon for each tool', () => {
      renderPanel()
      for (const tool of allTools) {
        expect(screen.getByTestId(`icon-${tool}`)).toBeInTheDocument()
      }
    })
  })

  describe('current tool highlight', () => {
    it.for([
      [Tools.MaskPen, 'Pen'],
      [Tools.Eraser, 'Eraser'],
      [Tools.PaintPen, 'Paint pen']
    ] as const)(
      'should press the %s button when it is current',
      ([tool, name]) => {
        mockStore.currentTool = tool
        renderPanel()

        expect(getToolButton(name)).toHaveAttribute('aria-pressed', 'true')
        expect(getToolButton(name).className).toContain(
          'maskEditor_toolPanelContainerSelected'
        )
      }
    )

    it('should not press the other tools', () => {
      mockStore.currentTool = Tools.MaskPen
      renderPanel()

      expect(getToolButton('Eraser')).toHaveAttribute('aria-pressed', 'false')
    })
  })

  describe('tool selection', () => {
    it('should call toolManager.switchTool with the clicked tool', async () => {
      const user = userEvent.setup()
      renderPanel()

      await user.click(getToolButton('Eraser'))

      expect(mockToolManager.switchTool).toHaveBeenCalledWith(Tools.Eraser)
    })
  })

  describe('color picker', () => {
    it('should show the color picker for the paint pen', () => {
      mockStore.currentTool = Tools.PaintPen
      renderPanel()

      const input = screen.getByLabelText('Color Selector')
      expect(useMaskEditorStore().colorInput).toBe(input)
    })

    it.for([
      Tools.MaskPen,
      Tools.Eraser,
      Tools.MaskBucket,
      Tools.MaskColorFill
    ] as const)('should hide the color picker for %s', (tool) => {
      mockStore.currentTool = tool
      renderPanel()

      expect(screen.queryByLabelText('Color Selector')).toBeNull()
      expect(useMaskEditorStore().colorInput).toBeNull()
    })

    it('should clear the store ref when the panel unmounts', () => {
      mockStore.currentTool = Tools.PaintPen
      const { unmount } = renderPanel()
      expect(useMaskEditorStore().colorInput).not.toBeNull()

      unmount()

      expect(useMaskEditorStore().colorInput).toBeNull()
    })
  })

  describe('zoom indicator', () => {
    it('should render the rounded zoom percentage', () => {
      mockStore.displayZoomRatio = 1.236
      renderPanel()

      expect(screen.getByTestId('zoom-percentage').textContent).toBe('124%')
      expect(
        screen.getByRole('button', { name: /Click to reset zoom/ })
      ).toHaveAccessibleName(/124%/)
    })

    it('should render image dimensions when an image is loaded', () => {
      mockStore.image = new Image(800, 600)
      renderPanel()

      expect(screen.getByTestId('zoom-dimensions').textContent).toBe('800x600')
    })

    it('should render a single-space placeholder when there is no image', () => {
      mockStore.image = null
      renderPanel()

      expect(screen.getByTestId('zoom-dimensions').textContent).toBe(' ')
    })

    it('should call resetZoom from the zoom button', async () => {
      const user = userEvent.setup()
      renderPanel()

      await user.click(
        screen.getByRole('button', { name: /Click to reset zoom/ })
      )

      expect(mockStore.resetZoom).toHaveBeenCalledTimes(1)
    })
  })
})
