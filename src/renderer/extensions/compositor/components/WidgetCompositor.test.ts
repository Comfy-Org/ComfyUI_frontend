import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { app } from '@/scripts/app'
import { toNodeId } from '@/types/nodeId'

import {
  clearCompositorLayers,
  setCompositorLayers
} from '../composables/useCompositorLayers'
import WidgetCompositor from './WidgetCompositor.vue'

vi.mock(import('@/scripts/app'))

vi.mock(
  import('@/renderer/extensions/compositor/composables/useCompositorEditor'),
  () => ({
    useCompositorEditor: () => ({ openCompositorEditor: vi.fn() })
  })
)
vi.mock(
  import('@/renderer/extensions/compositor/composables/useCompositorPsdDownload'),
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
      plugins: [i18n]
    }
  })
}

describe('WidgetCompositor', () => {
  beforeEach(() => {
    const graph = app.canvas.graph
    if (!graph) throw new Error('Expected the app mock to provide a graph')
    vi.spyOn(graph, 'getNodeById').mockReturnValue(null)
    clearCompositorLayers(graphNode)
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
    const graph = app.canvas.graph
    if (!graph) throw new Error('Expected the app mock to provide a graph')
    vi.mocked(graph.getNodeById).mockReturnValue(graphNode)
    setCompositorLayers(graphNode, [
      { filename: 'a.png', subfolder: '', type: 'temp' }
    ])

    renderWidget()

    const open = screen.getByTestId('compositor-open-button')
    expect(open.hasAttribute('disabled')).toBe(false)
  })
})
