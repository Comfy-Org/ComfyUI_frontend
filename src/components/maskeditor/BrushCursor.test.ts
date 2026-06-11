import { render, screen } from '@testing-library/vue'
import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BrushCursor from '@/components/maskeditor/BrushCursor.vue'
import { BrushShape } from '@/extensions/core/maskeditor/types'

const initialMock = () =>
  reactive({
    brushVisible: true,
    brushPreviewGradientVisible: false,
    brushSettings: {
      type: BrushShape.Arc,
      size: 20,
      opacity: 0.7,
      hardness: 1,
      stepSize: 5
    },
    zoomRatio: 1,
    cursorPoint: { x: 100, y: 50 },
    panOffset: { x: 0, y: 0 }
  })

let mockStore: ReturnType<typeof initialMock>

vi.mock('@/stores/maskEditorStore', () => ({
  useMaskEditorStore: () => mockStore
}))

const styleOf = (el: Element): string => el.getAttribute('style') ?? ''

const renderCursor = (containerRef?: HTMLElement) =>
  render(BrushCursor, {
    props: containerRef ? { containerRef } : {}
  })

const getBrushEl = (): HTMLElement => screen.getByTestId('brush-cursor')

const getGradientEl = (): HTMLElement =>
  screen.getByTestId('brush-cursor-gradient')

describe('BrushCursor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    mockStore = initialMock()
  })

  describe('opacity', () => {
    it('should be 1 when brushVisible is true', () => {
      renderCursor()
      expect(styleOf(getBrushEl())).toContain('opacity: 1')
    })

    it('should be 0 when brushVisible is false', () => {
      mockStore.brushVisible = false
      renderCursor()
      expect(styleOf(getBrushEl())).toContain('opacity: 0')
    })
  })

  describe('size and shape', () => {
    it('should compute size as 2 * effectiveBrushSize * zoomRatio', () => {
      // size=20, hardness=1 → effective=20; zoom=2 → diameter = 80
      mockStore.brushSettings.size = 20
      mockStore.brushSettings.hardness = 1
      mockStore.zoomRatio = 2

      renderCursor()

      const style = styleOf(getBrushEl())
      expect(style).toContain('width: 80px')
      expect(style).toContain('height: 80px')
    })

    it('should grow effective size when hardness drops below 1', () => {
      mockStore.brushSettings.size = 100
      mockStore.brushSettings.hardness = 0
      mockStore.zoomRatio = 1

      renderCursor()

      // effective = 100 * (1 + 1.0 * 0.5) = 150 → diameter = 300
      expect(styleOf(getBrushEl())).toContain('width: 300px')
    })

    it('should use 50% borderRadius for Arc brush', () => {
      mockStore.brushSettings.type = BrushShape.Arc
      renderCursor()
      expect(styleOf(getBrushEl())).toContain('border-radius: 50%')
    })

    it('should use 0% borderRadius for Rect brush', () => {
      mockStore.brushSettings.type = BrushShape.Rect
      renderCursor()
      expect(styleOf(getBrushEl())).toContain('border-radius: 0%')
    })
  })

  describe('position', () => {
    it('should anchor to cursorPoint plus panOffset minus radius (no container)', () => {
      mockStore.cursorPoint = { x: 200, y: 300 }
      mockStore.panOffset = { x: 50, y: 25 }
      mockStore.brushSettings.size = 20
      mockStore.brushSettings.hardness = 1
      mockStore.zoomRatio = 1

      renderCursor()

      // radius = effective(20,1) * 1 = 20
      // left = 200 + 50 - 20 = 230
      // top = 300 + 25 - 20 = 305
      const style = styleOf(getBrushEl())
      expect(style).toContain('left: 230px')
      expect(style).toContain('top: 305px')
    })

    it('should subtract container offset when containerRef is provided', () => {
      mockStore.cursorPoint = { x: 200, y: 300 }
      mockStore.panOffset = { x: 0, y: 0 }
      mockStore.brushSettings.size = 20
      mockStore.brushSettings.hardness = 1
      mockStore.zoomRatio = 1

      const container = document.createElement('div')
      vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
        left: 30,
        top: 60,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => ({})
      } as DOMRect)

      renderCursor(container)

      // left = 200 + 0 - 20 - 30 = 150; top = 300 + 0 - 20 - 60 = 220
      const style = styleOf(getBrushEl())
      expect(style).toContain('left: 150px')
      expect(style).toContain('top: 220px')
    })
  })

  describe('gradient preview', () => {
    it('should be hidden by default', () => {
      mockStore.brushPreviewGradientVisible = false
      renderCursor()
      expect(styleOf(getGradientEl())).toContain('display: none')
    })

    it('should be visible when brushPreviewGradientVisible is true', () => {
      mockStore.brushPreviewGradientVisible = true
      renderCursor()
      expect(styleOf(getGradientEl())).toContain('display: block')
    })

    it('should use a flat fill at hardness=1', () => {
      mockStore.brushPreviewGradientVisible = true
      mockStore.brushSettings.hardness = 1
      mockStore.brushSettings.size = 20
      renderCursor()

      // hard brush: getEffectiveHardness = (20*1)/20 = 1 → flat color
      const style = styleOf(getGradientEl())
      expect(style).toContain('rgba(255, 0, 0, 0.5)')
      expect(style).not.toContain('radial-gradient')
    })

    // The radial-gradient (hardness < 1) branch uses a multi-line template
    // literal as the background value; happy-dom's CSS parser drops the
    // declaration entirely, so we can't assert on the rendered style. The
    // underlying math (getEffectiveBrushSize / getEffectiveHardness) is
    // covered by brushUtils.test.ts.
  })
})
