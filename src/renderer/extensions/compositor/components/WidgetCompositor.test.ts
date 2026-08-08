import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { toNodeId } from '@/types/nodeId'

import {
  clearCompositorLayers,
  setCompositorLayers
} from '../composables/useCompositorLayers'
import WidgetCompositor from './WidgetCompositor.vue'

const { getNodeById } = vi.hoisted(() => ({
  getNodeById: vi.fn<() => unknown>(() => undefined)
}))

vi.mock('@/scripts/app', () => ({
  app: { canvas: { graph: { getNodeById } } }
}))
vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => ({
    getNodeImageUrls: () => undefined,
    nodeOutputs: {},
    nodePreviewImages: {}
  })
}))
vi.mock(
  '@/renderer/extensions/compositor/composables/useCompositorEditor',
  () => ({
    useCompositorEditor: () => ({ openCompositorEditor: vi.fn() })
  })
)
vi.mock(
  '@/renderer/extensions/compositor/composables/useCompositorPsdDownload',
  () => ({
    useCompositorPsdDownload: () => ({
      exporting: ref(false),
      downloadPsd: vi.fn()
    })
  })
)
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const nodeId = toNodeId(9)
const graphNode = { id: nodeId, graph: null } as unknown as LGraphNode

function renderWidget() {
  return render(WidgetCompositor, {
    props: { nodeId },
    global: { stubs: { Button: { template: '<button v-bind="$attrs" />' } } }
  })
}

describe('WidgetCompositor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearCompositorLayers(graphNode)
    getNodeById.mockReturnValue(undefined)
  })

  it('renders the empty state when the node is not in the graph (search preview)', () => {
    renderWidget()

    expect(screen.getByTestId('compositor-empty')).toBeTruthy()
    const open = screen.getByTestId('compositor-open-button')
    expect(open.hasAttribute('disabled')).toBe(true)
  })

  it('enables opening once the graph node exists with cached layers', () => {
    getNodeById.mockReturnValue(graphNode)
    setCompositorLayers(graphNode, [
      { filename: 'a.png', subfolder: '', type: 'temp' }
    ])

    renderWidget()

    const open = screen.getByTestId('compositor-open-button')
    expect(open.hasAttribute('disabled')).toBe(false)
  })
})
