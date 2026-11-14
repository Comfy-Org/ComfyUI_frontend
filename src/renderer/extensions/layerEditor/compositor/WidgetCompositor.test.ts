import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

import {
  clearCompositorLayers,
  setCompositorLayers
} from '@/renderer/extensions/layerEditor/compositor/useCompositorLayers'
import WidgetCompositor from './WidgetCompositor.vue'

vi.mock(import('@/scripts/app'))

const openCompositorEditor = vi.hoisted(() => vi.fn())

vi.mock(
  import('@/renderer/extensions/layerEditor/compositor/useCompositorEditor'),
  () => ({
    useCompositorEditor: () => ({ openCompositorEditor })
  })
)
vi.mock(
  import('@/renderer/extensions/layerEditor/compositor/useCompositorPsdDownload'),
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

function addCompositorNode(): LGraphNode {
  const node = new LGraphNode('Compositor')
  node.id = nodeId
  app.rootGraph.add(node)
  return node
}

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
    useCanvasStore().currentGraph = app.rootGraph
    clearCompositorLayers({ id: nodeId, graph: app.rootGraph })
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
    setCompositorLayers(addCompositorNode(), [
      { filename: 'a.png', subfolder: '', type: 'temp' }
    ])

    renderWidget()

    const open = screen.getByTestId('compositor-open-button')
    expect(open.hasAttribute('disabled')).toBe(false)
  })

  it('opens the editor for the node a reloaded graph holds', async () => {
    const staleNode = addCompositorNode()
    setCompositorLayers(staleNode, [
      { filename: 'a.png', subfolder: '', type: 'temp' }
    ])
    renderWidget()
    app.rootGraph.remove(staleNode)
    const reloadedNode = addCompositorNode()

    app.rootGraph.events.dispatch('configured')
    await userEvent.click(screen.getByTestId('compositor-open-button'))

    expect(openCompositorEditor.mock.lastCall?.[0]).toBe(reloadedNode)
  })
})
