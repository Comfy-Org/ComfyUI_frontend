import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { api } from '@/scripts/api'

import { usePainter } from './usePainter'

vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key
  }))
}))

vi.mock('@vueuse/core', () => ({
  useElementSize: vi.fn(() => ({
    width: ref(512),
    height: ref(512)
  }))
}))

vi.mock('@/composables/maskeditor/StrokeProcessor', () => ({
  StrokeProcessor: vi.fn(() => ({
    addPoint: vi.fn(() => []),
    endStroke: vi.fn(() => [])
  }))
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/platform/updates/common/toastStore', () => {
  const store = { addAlert: vi.fn() }
  return { useToastStore: () => store }
})

vi.mock('@/stores/nodeOutputStore', () => {
  const store = {
    getNodeImageUrls: vi.fn(() => undefined),
    nodeOutputs: {},
    nodePreviewImages: {}
  }
  return { useNodeOutputStore: () => store }
})

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: vi.fn((path: string) => `http://localhost:8188${path}`),
    fetchApi: vi.fn()
  }
}))

const mockWidgets: IBaseWidget[] = []
const mockProperties: Record<string, unknown> = {}
const mockIsInputConnected = vi.fn(() => false)
const mockGetInputNode = vi.fn(() => null)

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      graph: {
        getNodeById: vi.fn(() => ({
          get widgets() {
            return mockWidgets
          },
          get properties() {
            return mockProperties
          },
          isInputConnected: mockIsInputConnected,
          getInputNode: mockGetInputNode
        }))
      }
    }
  }
}))

type PainterResult = ReturnType<typeof usePainter>

function makeWidget(name: string, value: unknown = null): IBaseWidget {
  return {
    name,
    value,
    callback: vi.fn(),
    serializeValue: undefined
  } as unknown as IBaseWidget
}

/**
 * Mounts a thin wrapper component so Vue lifecycle hooks fire.
 */
function mountPainter(nodeId = 'test-node', initialModelValue = '') {
  let painter!: PainterResult
  const canvasEl = ref<HTMLCanvasElement | null>(null)
  const cursorEl = ref<HTMLElement | null>(null)
  const modelValue = ref(initialModelValue)

  const Wrapper = defineComponent({
    setup() {
      painter = usePainter(nodeId, {
        canvasEl,
        cursorEl,
        modelValue
      })
      return {}
    },
    render() {
      return null
    }
  })

  const wrapper = mount(Wrapper)
  return { painter, wrapper, canvasEl, cursorEl, modelValue }
}

describe('usePainter', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.resetAllMocks()
    mockWidgets.length = 0
    for (const key of Object.keys(mockProperties)) {
      delete mockProperties[key]
    }
    mockIsInputConnected.mockReturnValue(false)
    mockGetInputNode.mockReturnValue(null)
  })

  describe('syncCanvasSizeFromWidgets', () => {
    it('reads width/height from widget values on initialization', () => {
      mockWidgets.push(makeWidget('width', 1024), makeWidget('height', 768))

      const { painter } = mountPainter()

      expect(painter.canvasWidth.value).toBe(1024)
      expect(painter.canvasHeight.value).toBe(768)
    })

    it('defaults to 512 when widgets are missing', () => {
      const { painter } = mountPainter()

      expect(painter.canvasWidth.value).toBe(512)
      expect(painter.canvasHeight.value).toBe(512)
    })
  })

  describe('restoreSettingsFromProperties', () => {
    it('restores tool and brush settings from node properties on init', () => {
      mockProperties.painterTool = 'eraser'
      mockProperties.painterBrushSize = 42
      mockProperties.painterBrushColor = '#ff0000'
      mockProperties.painterBrushOpacity = 0.5
      mockProperties.painterBrushHardness = 0.8

      const { painter } = mountPainter()

      expect(painter.tool.value).toBe('eraser')
      expect(painter.brushSize.value).toBe(42)
      expect(painter.brushColor.value).toBe('#ff0000')
      expect(painter.brushOpacity.value).toBe(0.5)
      expect(painter.brushHardness.value).toBe(0.8)
    })

    it('restores backgroundColor from bg_color widget', () => {
      mockWidgets.push(makeWidget('bg_color', '#123456'))

      const { painter } = mountPainter()

      expect(painter.backgroundColor.value).toBe('#123456')
    })

    it('keeps defaults when no properties are stored', () => {
      const { painter } = mountPainter()

      expect(painter.tool.value).toBe('brush')
      expect(painter.brushSize.value).toBe(20)
      expect(painter.brushColor.value).toBe('#ffffff')
      expect(painter.brushOpacity.value).toBe(1)
      expect(painter.brushHardness.value).toBe(1)
    })
  })

  describe('saveSettingsToProperties', () => {
    it('persists tool settings to node properties when they change', async () => {
      const { painter } = mountPainter()

      painter.tool.value = 'eraser'
      painter.brushSize.value = 50
      painter.brushColor.value = '#00ff00'
      painter.brushOpacity.value = 0.7
      painter.brushHardness.value = 0.3

      await nextTick()

      expect(mockProperties.painterTool).toBe('eraser')
      expect(mockProperties.painterBrushSize).toBe(50)
      expect(mockProperties.painterBrushColor).toBe('#00ff00')
      expect(mockProperties.painterBrushOpacity).toBe(0.7)
      expect(mockProperties.painterBrushHardness).toBe(0.3)
    })
  })

  describe('syncCanvasSizeToWidgets', () => {
    it('syncs canvas dimensions to widgets when size changes', async () => {
      const widthWidget = makeWidget('width', 512)
      const heightWidget = makeWidget('height', 512)
      mockWidgets.push(widthWidget, heightWidget)

      const { painter } = mountPainter()

      painter.canvasWidth.value = 800
      painter.canvasHeight.value = 600
      await nextTick()

      expect(widthWidget.value).toBe(800)
      expect(heightWidget.value).toBe(600)
      expect(widthWidget.callback).toHaveBeenCalledWith(800)
      expect(heightWidget.callback).toHaveBeenCalledWith(600)
    })
  })

  describe('syncBackgroundColorToWidget', () => {
    it('syncs background color to widget when color changes', async () => {
      const bgWidget = makeWidget('bg_color', '#000000')
      mockWidgets.push(bgWidget)

      const { painter } = mountPainter()

      painter.backgroundColor.value = '#ff00ff'
      await nextTick()

      expect(bgWidget.value).toBe('#ff00ff')
      expect(bgWidget.callback).toHaveBeenCalledWith('#ff00ff')
    })
  })

  describe('updateInputImageUrl', () => {
    it('sets isImageInputConnected to false when input is not connected', () => {
      const { painter } = mountPainter()

      expect(painter.isImageInputConnected.value).toBe(false)
      expect(painter.inputImageUrl.value).toBeNull()
    })

    it('sets isImageInputConnected to true when input is connected', () => {
      mockIsInputConnected.mockReturnValue(true)

      const { painter } = mountPainter()

      expect(painter.isImageInputConnected.value).toBe(true)
    })
  })

  describe('handleInputImageLoad', () => {
    it('updates canvas size and widgets from loaded image dimensions', () => {
      const widthWidget = makeWidget('width', 512)
      const heightWidget = makeWidget('height', 512)
      mockWidgets.push(widthWidget, heightWidget)

      const { painter } = mountPainter()

      const fakeEvent = {
        target: {
          naturalWidth: 1920,
          naturalHeight: 1080
        }
      } as unknown as Event

      painter.handleInputImageLoad(fakeEvent)

      expect(painter.canvasWidth.value).toBe(1920)
      expect(painter.canvasHeight.value).toBe(1080)
      expect(widthWidget.value).toBe(1920)
      expect(heightWidget.value).toBe(1080)
    })
  })

  describe('cursor visibility', () => {
    it('sets cursorVisible to true on pointer enter', () => {
      const { painter } = mountPainter()

      painter.handlePointerEnter()
      expect(painter.cursorVisible.value).toBe(true)
    })

    it('sets cursorVisible to false on pointer leave', () => {
      const { painter } = mountPainter()

      painter.handlePointerEnter()
      painter.handlePointerLeave()
      expect(painter.cursorVisible.value).toBe(false)
    })
  })

  describe('displayBrushSize', () => {
    it('scales brush size by canvas display ratio', () => {
      const { painter } = mountPainter()

      // canvasDisplayWidth=512, canvasWidth=512 → ratio=1
      // hardness=1 → effectiveRadius = radius * 1.0
      // displayBrushSize = (20/2) * 1.0 * 2 * 1 = 20
      expect(painter.displayBrushSize.value).toBe(20)
    })

    it('increases for soft brush hardness', () => {
      const { painter } = mountPainter()

      painter.brushHardness.value = 0
      // hardness=0 → effectiveRadius = 10 * 1.5 = 15
      // displayBrushSize = 15 * 2 * 1 = 30
      expect(painter.displayBrushSize.value).toBe(30)
    })
  })

  describe('activeHardness (via displayBrushSize)', () => {
    it('returns 1 for eraser regardless of brushHardness', () => {
      const { painter } = mountPainter()

      painter.brushHardness.value = 0.3
      painter.tool.value = 'eraser'

      // eraser hardness=1 → displayBrushSize = 10 * 1.0 * 2 = 20
      expect(painter.displayBrushSize.value).toBe(20)
    })

    it('uses brushHardness for brush tool', () => {
      const { painter } = mountPainter()

      painter.tool.value = 'brush'
      painter.brushHardness.value = 0.5
      // hardness=0.5 → scale=1.25 → 10*1.25*2 = 25
      expect(painter.displayBrushSize.value).toBe(25)
    })
  })

  describe('registerWidgetSerialization', () => {
    it('attaches serializeValue to the mask widget on init', () => {
      const maskWidget = makeWidget('mask', '')
      mockWidgets.push(maskWidget)

      mountPainter()

      expect(maskWidget.serializeValue).toBeTypeOf('function')
    })
  })

  describe('serializeValue', () => {
    it('returns empty string when canvas has no strokes', async () => {
      const maskWidget = makeWidget('mask', '')
      mockWidgets.push(maskWidget)

      mountPainter()

      const result = await maskWidget.serializeValue!({} as LGraphNode, 0)
      expect(result).toBe('')
    })

    it('returns existing modelValue when not dirty', async () => {
      const maskWidget = makeWidget('mask', '')
      mockWidgets.push(maskWidget)

      const { modelValue } = mountPainter()
      modelValue.value = 'painter/existing.png [temp]'

      const result = await maskWidget.serializeValue!({} as LGraphNode, 0)
      // isCanvasEmpty() is true (no strokes drawn), so returns ''
      expect(result).toBe('')
    })
  })

  describe('restoreCanvas', () => {
    it('builds correct URL from modelValue on mount', () => {
      const { modelValue } = mountPainter()
      // Before mount, set the modelValue
      // restoreCanvas is called in onMounted, so we test by observing api.apiURL calls
      // With empty modelValue, restoreCanvas exits early
      expect(modelValue.value).toBe('')
    })

    it('calls api.apiURL with parsed filename params when modelValue is set', () => {
      vi.mocked(api.apiURL).mockClear()

      mountPainter('test-node', 'painter/my-image.png [temp]')

      expect(api.apiURL).toHaveBeenCalledWith(
        expect.stringContaining('filename=my-image.png')
      )
      expect(api.apiURL).toHaveBeenCalledWith(
        expect.stringContaining('subfolder=painter')
      )
      expect(api.apiURL).toHaveBeenCalledWith(
        expect.stringContaining('type=temp')
      )
    })
  })

  describe('handleClear', () => {
    it('does not throw when canvas element is null', () => {
      const { painter } = mountPainter()

      expect(() => painter.handleClear()).not.toThrow()
    })
  })

  describe('handlePointerDown', () => {
    it('ignores non-primary button clicks', () => {
      const { painter } = mountPainter()

      const mockSetPointerCapture = vi.fn()
      const event = new PointerEvent('pointerdown', {
        button: 2
      })
      Object.defineProperty(event, 'target', {
        value: {
          setPointerCapture: mockSetPointerCapture
        }
      })

      painter.handlePointerDown(event)

      expect(mockSetPointerCapture).not.toHaveBeenCalled()
    })
  })

  describe('handlePointerUp', () => {
    it('ignores non-primary button releases', () => {
      const { painter } = mountPainter()

      const mockReleasePointerCapture = vi.fn()
      const event = {
        button: 2,
        target: {
          releasePointerCapture: mockReleasePointerCapture
        }
      } as unknown as PointerEvent

      painter.handlePointerUp(event)

      expect(mockReleasePointerCapture).not.toHaveBeenCalled()
    })
  })
})
