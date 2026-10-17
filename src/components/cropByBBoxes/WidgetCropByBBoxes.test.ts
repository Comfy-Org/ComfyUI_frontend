import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { useElementSize, useImage } from '@vueuse/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref, shallowRef } from 'vue'
import type { Ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { BoundingBoxInput } from '@/composables/boundingBoxes/boundingBoxesUtil'
import { renderCropByBBoxesPreview } from '@/components/cropByBBoxes/drawCropByBBoxesPreview'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { toNodeId } from '@/types/nodeId'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

import WidgetCropByBBoxes from './WidgetCropByBBoxes.vue'

const sources = vi.hoisted(() => ({
  connected: undefined as Ref<boolean> | undefined,
  url: undefined as Ref<string | undefined> | undefined,
  boxes: undefined as Ref<BoundingBoxInput[] | undefined> | undefined
}))

vi.mock(import('@vueuse/core'), { spy: true })
vi.mock(import('@/components/cropByBBoxes/drawCropByBBoxesPreview'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/utils/graphTraversalUtil'), () => ({
  getNodeByLocatorId: vi.fn()
}))

vi.mock(
  import('@/renderer/extensions/vueNodes/widgets/composables/useInputImageSource'),
  async () => {
    const { computed } = await import('vue')
    return {
      useInputImageSource: () => ({
        connected: computed(() => sources.connected!.value),
        url: computed(() => sources.url!.value)
      })
    }
  }
)

vi.mock(
  import('@/renderer/extensions/vueNodes/widgets/composables/useIncomingBoundingBoxes'),
  async () => {
    const { computed } = await import('vue')
    return {
      useIncomingBoundingBoxes: () => computed(() => sources.boxes!.value)
    }
  }
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      imageCrop: {
        noInputImage: 'No input image connected',
        cropPreviewAlt: 'Crop preview'
      },
      cropByBBoxes: {
        runToPreview: 'Run the workflow to preview the crop',
        noBoxes: 'No bounding boxes in the first frame',
        cropSize: 'Crop {width} × {height}',
        outputSize: 'Output {width} × {height} · {mode}'
      }
    }
  }
})

const WIDGET_DEFAULTS = {
  output_width: 512,
  output_height: 256,
  padding: 10,
  keep_aspect: 'pad'
}

interface SetupOptions {
  connected: boolean
  url: string | undefined
  boxes: BoundingBoxInput[] | undefined
}

const SETUP_DEFAULTS: SetupOptions = {
  connected: true,
  url: '/view?filename=src.png',
  boxes: [
    { x: 100, y: 100, width: 40, height: 20 },
    { x: 150, y: 110, width: 10, height: 30 }
  ]
}

const loadedImage = fromPartial<HTMLImageElement>({
  naturalWidth: 400,
  naturalHeight: 300
})

beforeEach(() => {
  vi.mocked(useImage).mockReturnValue(
    fromPartial({ state: shallowRef(loadedImage) })
  )
  vi.mocked(useElementSize).mockReturnValue(
    fromPartial({ width: ref(320), height: ref(480) })
  )
})

function setup(overrides: Partial<SetupOptions> = {}) {
  const { connected, url, boxes } = { ...SETUP_DEFAULTS, ...overrides }
  sources.connected = ref(connected)
  sources.url = ref(url)
  sources.boxes = ref(boxes)

  const widgets = Object.entries(WIDGET_DEFAULTS).map(([name, value]) =>
    reactive({ name, value })
  )
  vi.mocked(getNodeByLocatorId).mockReturnValue(
    createMockLGraphNode({
      widgets: widgets.map((w) => fromPartial<IBaseWidget>(w))
    })
  )

  render(WidgetCropByBBoxes, {
    props: {
      widget: {
        name: '$$crop_bboxes_preview',
        type: 'cropbboxespreview',
        value: null,
        nodeLocatorId: createNodeLocatorId(null, toNodeId(1))
      },
      nodeId: toNodeId(1)
    },
    global: { plugins: [i18n] }
  })

  return {
    widget: (name: string) => widgets.find((w) => w.name === name)!,
    lastScene: () => vi.mocked(renderCropByBBoxesPreview).mock.lastCall?.[3]
  }
}

describe('WidgetCropByBBoxes', () => {
  it.for([
    {
      name: 'asks for an image when none is connected',
      options: { connected: false, url: undefined, boxes: undefined },
      text: 'No input image connected'
    },
    {
      name: 'asks for a run when the image has no preview yet',
      options: { url: undefined, boxes: undefined },
      text: 'Run the workflow to preview the crop'
    },
    {
      name: 'asks for a run when boxes have not arrived',
      options: { boxes: undefined },
      text: 'Run the workflow to preview the crop'
    },
    {
      name: 'reports a first frame without detections',
      options: { boxes: [] },
      text: 'No bounding boxes in the first frame'
    }
  ])('$name', ({ options, text }) => {
    setup(options)

    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it('draws the source alone until boxes arrive', async () => {
    const { lastScene } = setup({ boxes: undefined })
    await nextTick()

    expect(lastScene()).toEqual({
      image: loadedImage,
      imageWidth: 400,
      imageHeight: 300,
      boxes: []
    })
  })

  it('maps the padded output back onto the source around the crop', async () => {
    const { lastScene } = setup()
    await nextTick()

    expect(screen.getByRole('img', { name: 'Crop preview' })).toBeVisible()
    expect(lastScene()?.crop).toEqual({
      region: { x: 90, y: 90, width: 80, height: 60 },
      frame: {
        x: expect.closeTo(70.08),
        y: 90,
        width: expect.closeTo(120),
        height: expect.closeTo(60)
      },
      sizeFrame: undefined,
      cropLabel: 'Crop 80 × 60',
      outputLabel: 'Output 512 × 256 · pad'
    })
  })

  it('redraws when the node parameters change', async () => {
    const { widget, lastScene } = setup()
    await nextTick()

    widget('padding').value = 0
    widget('keep_aspect').value = 'stretch'
    widget('output_height').value = 512
    await nextTick()

    expect(lastScene()?.crop).toEqual({
      region: { x: 100, y: 100, width: 60, height: 40 },
      frame: { x: 100, y: 100, width: 60, height: 40 },
      sizeFrame: { x: -126, y: -136, width: 512, height: 512 },
      cropLabel: 'Crop 60 × 40',
      outputLabel: 'Output 512 × 512 · stretch'
    })
  })
})
