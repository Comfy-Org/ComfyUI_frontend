import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import LinkSelectionActions from '@/components/graph/selectionToolbox/LinkSelectionActions.vue'
import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import {
  selectLinksInMarquee,
  selectSlotLinks
} from '@/lib/litegraph/src/canvas/linkSelection'
import { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LinkRenderType } from '@/lib/litegraph/src/types/globalEnums'
import { useSettingStore } from '@/platform/settings/settingStore'
import { setLinkPolyline } from '@/renderer/core/canvas/linkPolylines'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { createMockCanvas } from '@/utils/__tests__/canvasTestUtils'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      selectionToolbox: {
        linkDestinations: {
          goTo: 'Go to {node}',
          goToLinkedNode: 'Go to a linked node',
          subgraphInputs: 'Subgraph Inputs',
          subgraphOutputs: 'Subgraph Outputs'
        }
      },
      commands: {
        Comfy_Canvas_HideSelectedLinks: { label: 'Hide Selected Links' },
        Comfy_Canvas_ShowSelectedLinks: { label: 'Show Selected Links' },
        Comfy_Canvas_DeleteSelectedLinks: { label: 'Delete Selected Links' }
      }
    }
  }
})

function createWorkflow() {
  const graph = new LGraph()
  const source = createTestNode(graph, [], ['number'], 'Load Checkpoint')
  const targets = ['Positive', 'Negative'].map((title, index) => {
    const target = createTestNode(graph, ['number'], [], title)
    target.pos = [400, index * 200]
    target.updateArea()
    return target
  })
  const links = targets.map((target) => {
    const link = source.connect(0, target, 0)
    if (!link) throw new Error('connect failed')
    return link
  })
  const canvas = createMockCanvas({
    graph,
    ds: { getViewportSize: () => [800, 600], fitToBounds: vi.fn() },
    animateToBounds: vi.fn()
  })
  useCanvasStore().canvas = canvas
  return { graph, source, targets, links, canvas }
}

function clickSocket(
  graph: LGraph,
  node: LGraphNode,
  type: 'input' | 'output'
) {
  selectSlotLinks(
    { graph, links_render_mode: LinkRenderType.SPLINE_LINK, deselectAll() {} },
    node,
    type,
    0,
    { x: 0, y: 0 }
  )
}

function renderActions() {
  const user = userEvent.setup()
  render(LinkSelectionActions, { global: { plugins: [i18n] } })
  return { user }
}

describe('LinkSelectionActions', () => {
  it('names the source node on the button for an input socket', () => {
    const { graph, targets } = createWorkflow()
    clickSocket(graph, targets[0], 'input')

    renderActions()

    expect(
      screen.getByRole('button', { name: 'Go to Load Checkpoint' })
    ).toBeInTheDocument()
  })

  it('moves the view to the source, then offers every node its output leads to', async () => {
    const { graph, source, targets, canvas } = createWorkflow()
    clickSocket(graph, targets[0], 'input')
    const { user } = renderActions()

    await user.click(
      screen.getByRole('button', { name: 'Go to Load Checkpoint' })
    )

    expect(canvas.animateToBounds).toHaveBeenCalledWith(source.boundingRect, {
      zoom: 0,
      viewport: [0, 0, 800, 600]
    })
    expect(
      await screen.findByRole('button', { name: 'Go to a linked node' })
    ).toBeInTheDocument()
  })

  it('lets the user pick one of the nodes an output socket leads to', async () => {
    const { graph, source, targets, canvas } = createWorkflow()
    clickSocket(graph, source, 'output')
    const { user } = renderActions()

    await user.click(
      screen.getByRole('button', { name: 'Go to a linked node' })
    )
    const items = await screen.findAllByRole('menuitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveAccessibleName(`Positive #${targets[0].id}`)
    expect(items[1]).toHaveAccessibleName(`Negative #${targets[1].id}`)
    await user.click(items[1])

    expect(canvas.animateToBounds).toHaveBeenCalledWith(
      targets[1].boundingRect,
      expect.anything()
    )
    expect(
      await screen.findByRole('button', { name: 'Go to Load Checkpoint' })
    ).toBeInTheDocument()
  })

  it('moves the view in one step when animations are turned off', async () => {
    const { graph, source, targets, canvas } = createWorkflow()
    useSettingStore().settingValues['Comfy.Appearance.DisableAnimations'] = true
    clickSocket(graph, targets[0], 'input')
    const { user } = renderActions()

    await user.click(
      screen.getByRole('button', { name: 'Go to Load Checkpoint' })
    )

    expect(canvas.ds.fitToBounds).toHaveBeenCalledWith(
      source.boundingRect,
      expect.anything()
    )
    expect(canvas.animateToBounds).not.toHaveBeenCalled()
  })

  it('offers no go-to action for a marquee selection', () => {
    const { graph, links } = createWorkflow()
    for (const link of links)
      setLinkPolyline(link, () => [
        { x: 0, y: 10 },
        { x: 100, y: 10 }
      ])
    selectLinksInMarquee({ graph, renderedPaths: links }, [40, 0, 20, 40], 50)

    renderActions()

    expect(
      screen.getByRole('button', { name: 'Hide Selected Links' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Go to/ })).toBeNull()
  })
})
