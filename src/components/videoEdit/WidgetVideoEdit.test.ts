import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import type { VideoEditValue } from '@/lib/litegraph/src/types/widgets'
import { toNodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetVideoEdit from './WidgetVideoEdit.vue'

const hostNode = { id: 'host' }
const locatorNode = { id: 'inner' }

const mocks = vi.hoisted(() => ({
  getNodeByLocatorId: vi.fn(),
  resolvedSource: undefined as unknown
}))

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: {},
    canvas: { graph: { getNodeById: () => hostNode } }
  }
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByLocatorId: mocks.getNodeByLocatorId
}))

vi.mock('@/composables/video/useVideoSourceUrl', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref: createRef } = require('vue')
  return {
    useVideoSourceUrl: (node: { value: unknown }) => {
      mocks.resolvedSource = node.value
      return { videoUrl: createRef('/api/view?filename=clip.mp4') }
    }
  }
})

vi.mock('@/composables/video/useVideoFilmstrip', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref: createRef } = require('vue')
  return {
    DEFAULT_VIDEO_FPS: 20,
    useVideoFilmstrip: () => ({
      thumbnails: createRef([]),
      duration: createRef(10),
      totalFrames: createRef(100),
      width: createRef(1920),
      height: createRef(1080),
      fps: createRef(10),
      fileSize: createRef(1024),
      loading: createRef(false)
    })
  }
})

const recorded: { props?: Record<string, unknown> } = {}

const PanelStub = defineComponent({
  props: [
    'features',
    'videoUrl',
    'thumbnails',
    'totalFrames',
    'duration',
    'fps',
    'fileSize',
    'width',
    'height',
    'loading',
    'startFrame',
    'endFrame',
    'cropBounds',
    'trimEnabled',
    'cropEnabled'
  ],
  emits: [
    'update:startFrame',
    'update:endFrame',
    'update:cropBounds',
    'update:trimEnabled',
    'update:cropEnabled'
  ],
  setup(props, { emit }) {
    recorded.props = props
    return () =>
      h('button', {
        'data-testid': 'emit-start-frame',
        onClick: () => emit('update:startFrame', 10)
      })
  }
})

function createWidget(
  options: Record<string, unknown> = {},
  extra: Record<string, unknown> = {}
): SimplifiedWidget<VideoEditValue> {
  return {
    name: 'edit',
    type: 'videoedit',
    value: {},
    options,
    ...extra
  } as SimplifiedWidget<VideoEditValue>
}

function renderWidget(widget = createWidget()) {
  const modelValue = ref<VideoEditValue>({})
  const Host = defineComponent({
    setup() {
      return () =>
        h(WidgetVideoEdit, {
          widget,
          nodeId: toNodeId('node-1'),
          modelValue: modelValue.value,
          'onUpdate:modelValue': (value: VideoEditValue) => {
            modelValue.value = value
          }
        })
    }
  })
  render(Host, {
    global: {
      stubs: { VideoEditPanel: PanelStub }
    }
  })
  return { modelValue }
}

describe('WidgetVideoEdit', () => {
  beforeEach(() => {
    recorded.props = undefined
    mocks.resolvedSource = undefined
    mocks.getNodeByLocatorId.mockReset()
  })

  it('resolves the source from the host node when no locator is present', () => {
    renderWidget()

    expect(mocks.getNodeByLocatorId).not.toHaveBeenCalled()
    expect(mocks.resolvedSource).toBe(hostNode)
  })

  it('resolves a promoted widget through its node locator id', () => {
    mocks.getNodeByLocatorId.mockReturnValue(locatorNode)

    renderWidget(createWidget({}, { nodeLocatorId: 'sub:42' }))

    expect(mocks.getNodeByLocatorId).toHaveBeenCalledWith({}, 'sub:42')
    expect(mocks.resolvedSource).toBe(locatorNode)
  })

  it('falls back to the host node when the locator resolves to nothing', () => {
    mocks.getNodeByLocatorId.mockReturnValue(null)

    renderWidget(createWidget({}, { nodeLocatorId: 'sub:42' }))

    expect(mocks.resolvedSource).toBe(hostNode)
  })

  it('defaults to both features when the widget options omit them', () => {
    renderWidget()

    expect(recorded.props?.features).toEqual(['trim', 'crop'])
  })

  it('passes the features from the widget options to the panel', () => {
    renderWidget(createWidget({ features: ['trim'] }))

    expect(recorded.props?.features).toEqual(['trim'])
  })

  it('feeds the resolved source url and probed metadata to the panel', () => {
    renderWidget()

    expect(recorded.props?.videoUrl).toBe('/api/view?filename=clip.mp4')
    expect(recorded.props?.duration).toBe(10)
    expect(recorded.props?.totalFrames).toBe(100)
  })

  it('writes trim seconds into the model when the panel moves a frame handle', async () => {
    const { modelValue } = renderWidget()

    await userEvent.click(screen.getByTestId('emit-start-frame'))

    expect(modelValue.value.trim).toEqual({ start_time: 1, duration: 0 })
  })
})
