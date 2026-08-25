import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

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
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      compositor: {
        empty: 'Run the workflow to generate a composite',
        open: 'Open Compositor',
        runWorkflowFirst: 'Run the workflow once to load input images',
        downloadPsd: 'Download PSD'
      }
    }
  }
})

const nodeId = toNodeId(9)
const graphNode = { id: nodeId, graph: null } as unknown as LGraphNode

function renderWidget() {
  return render(WidgetCompositor, {
    props: { nodeId },
    global: {
      plugins: [i18n],
      stubs: {
        Button: { template: '<button v-bind="$attrs"><slot /></button>' }
      }
    }
  })
}

describe('WidgetCompositor', () => {
  beforeEach(() => {
    clearCompositorLayers(graphNode)
    getNodeById.mockReturnValue(undefined)
  })

  it('renders the empty state when the node is not in the graph (search preview)', () => {
    renderWidget()

    expect(screen.getByTestId('compositor-empty').textContent).toContain(
      'Run the workflow to generate a composite'
    )
    const open = screen.getByTestId('compositor-open-button')
    expect(open.textContent).toContain('Open Compositor')
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
