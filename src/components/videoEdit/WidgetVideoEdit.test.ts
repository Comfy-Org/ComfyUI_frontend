import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PropType, Ref } from 'vue'
import { defineComponent, h, nextTick, ref } from 'vue'

import type { MediaSrcStatus } from '@/composables/media/useRetryableMediaSrc'
import type { FilmstripError } from '@/composables/video/useVideoFilmstrip'
import type {
  VideoEditFeature,
  VideoEditValue
} from '@/lib/litegraph/src/types/widgets'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { Bounds } from '@/renderer/core/layout/types'
import { toNodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

import WidgetVideoEdit from './WidgetVideoEdit.vue'

const hostNode = { id: 'host' }
const locatorNode = new LGraphNode('inner')
locatorNode.id = toNodeId('inner')

const mocks = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref: createRef } = require('vue')
  const mocks: {
    resolvedSource: unknown
    sourceStatus: Ref<MediaSrcStatus>
    filmstripLoading: Ref<boolean>
    filmstripError: Ref<FilmstripError | null>
    onError: ReturnType<typeof vi.fn>
    retry: ReturnType<typeof vi.fn>
  } = {
    resolvedSource: undefined,
    sourceStatus: createRef('loading'),
    filmstripLoading: createRef(false),
    filmstripError: createRef(null),
    onError: vi.fn(),
    retry: vi.fn()
  }
  return mocks
})

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    rootGraph: {},
    canvas: { graph: { getNodeById: () => hostNode } }
  }
}))

vi.mock(import('@/utils/graphTraversalUtil'))

vi.mock<unknown>(import('@/composables/video/useVideoSourceUrl'), () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref: createRef } = require('vue')
  return {
    useVideoSourceUrl: (node: { value: unknown }) => {
      mocks.resolvedSource = node.value
      return {
        videoUrl: createRef('/api/view?filename=clip.mp4'),
        status: mocks.sourceStatus,
        onError: mocks.onError,
        retry: mocks.retry
      }
    }
  }
})

vi.mock<unknown>(import('@/composables/video/useVideoFilmstrip'), () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref: createRef } = require('vue')
  return {
    DEFAULT_VIDEO_FPS: 20,
    useVideoFilmstrip: () => ({
      thumbnail: createRef(''),
      duration: createRef(10),
      totalFrames: createRef(100),
      width: createRef(1920),
      height: createRef(1080),
      fps: createRef(10),
      fileSize: createRef(1024),
      loading: mocks.filmstripLoading,
      error: mocks.filmstripError
    })
  }
})

const recorded: { props?: Record<string, unknown> } = {}

const PanelStub = defineComponent({
  props: {
    features: { type: Array as PropType<VideoEditFeature[]>, required: true },
    videoUrl: { type: String, required: false },
    thumbnail: { type: String, required: true },
    totalFrames: { type: Number, required: true },
    duration: { type: Number, required: true },
    fps: { type: Number, required: true },
    fileSize: { type: Number, required: false },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    loading: { type: Boolean, required: false },
    error: { type: String, required: false },
    hasSource: { type: Boolean, required: false },
    startFrame: { type: Number, required: true },
    endFrame: { type: Number, required: true },
    cropBounds: { type: Object as PropType<Bounds>, required: true }
  },
  emits: [
    'update:startFrame',
    'update:endFrame',
    'update:cropBounds',
    'retry',
    'loadError'
  ],
  setup(props, { emit }) {
    recorded.props = props
    return () => [
      h('button', {
        'data-testid': 'emit-start-frame',
        onClick: () => emit('update:startFrame', 10)
      }),
      h('button', {
        'data-testid': 'emit-retry',
        onClick: () => emit('retry')
      }),
      h('button', {
        'data-testid': 'emit-load-error',
        onClick: () => emit('loadError')
      })
    ]
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
  }
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
    mocks.sourceStatus.value = 'loading'
    mocks.filmstripLoading.value = false
    mocks.filmstripError.value = null
    mocks.onError.mockClear()
    mocks.retry.mockClear()
  })

  it('resolves the source from the host node when no locator is present', () => {
    renderWidget()

    expect(getNodeByLocatorId).not.toHaveBeenCalled()
    expect(mocks.resolvedSource).toBe(hostNode)
  })

  it('resolves a promoted widget through its node locator id', () => {
    vi.mocked(getNodeByLocatorId).mockReturnValue(locatorNode)

    renderWidget(createWidget({}, { nodeLocatorId: 'sub:42' }))

    expect(getNodeByLocatorId).toHaveBeenCalledWith({}, 'sub:42')
    expect(mocks.resolvedSource).toBe(locatorNode)
  })

  it('falls back to the host node when the locator resolves to nothing', () => {
    vi.mocked(getNodeByLocatorId).mockReturnValue(null)

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

  it('forwards a filmstrip load failure to the source retry', async () => {
    renderWidget()

    mocks.filmstripError.value = 'load-failed'
    await nextTick()

    expect(mocks.onError).toHaveBeenCalledTimes(1)
  })

  it('does not retry when the canvas is unavailable', async () => {
    renderWidget()

    mocks.filmstripError.value = 'canvas-unavailable'
    await nextTick()

    expect(mocks.onError).not.toHaveBeenCalled()
    expect(recorded.props?.error).toBe('canvas-unavailable')
  })

  it('forwards a panel load error to the source retry', async () => {
    renderWidget()

    await userEvent.click(screen.getByTestId('emit-load-error'))

    expect(mocks.onError).toHaveBeenCalledTimes(1)
  })

  it('retries the source load when the panel asks for it', async () => {
    renderWidget()

    await userEvent.click(screen.getByTestId('emit-retry'))

    expect(mocks.retry).toHaveBeenCalledTimes(1)
  })

  it('shows the loading overlay while the source is retrying', async () => {
    renderWidget()

    mocks.sourceStatus.value = 'retrying'
    await nextTick()

    expect(recorded.props?.loading).toBe(true)
    expect(recorded.props?.error).toBeNull()
  })

  it('shows the load error only once the source has failed', async () => {
    renderWidget()

    mocks.sourceStatus.value = 'retrying'
    mocks.filmstripError.value = 'load-failed'
    await nextTick()

    expect(recorded.props?.error).toBeNull()

    mocks.sourceStatus.value = 'failed'
    await nextTick()

    expect(recorded.props?.error).toBe('load-failed')
  })

  it('gates the panel on the source status', async () => {
    renderWidget()

    mocks.sourceStatus.value = 'idle'
    await nextTick()

    expect(recorded.props?.hasSource).toBe(false)

    mocks.sourceStatus.value = 'loading'
    await nextTick()

    expect(recorded.props?.hasSource).toBe(true)
  })

  it('terminal source failure wins over a stale filmstrip loading state', async () => {
    renderWidget()

    mocks.filmstripLoading.value = true
    mocks.sourceStatus.value = 'failed'
    await nextTick()

    expect(recorded.props?.loading).toBe(false)
    expect(recorded.props?.error).toBe('load-failed')
  })

  it('writes trim seconds into the model when the panel moves a frame handle', async () => {
    const { modelValue } = renderWidget()

    await userEvent.click(screen.getByTestId('emit-start-frame'))

    expect(modelValue.value.trim).toEqual({ start_time: 1, duration: 0 })
  })
})
