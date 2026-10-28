import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import LinkDestinationButton from '@/components/graph/selectionToolbox/LinkDestinationButton.vue'
import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import type { DragAndScale } from '@/lib/litegraph/src/DragAndScale'
import {
  getSelectedLinkIds,
  selectLinksInMarquee,
  selectSlotLinks
} from '@/lib/litegraph/src/canvas/linkSelection'
import { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LinkRenderType } from '@comfyorg/graph-model/globalEnums'
import enMain from '@/locales/en/main.json' with { type: 'json' }
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { setLinkPolyline } from '@/renderer/core/canvas/linkPolylines'
import {
  createMockCanvas,
  createTestDragAndScale
} from '@/utils/__tests__/canvasTestUtils'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMain }
})

function createWorkflow(
  ds: Pick<DragAndScale, 'getViewportSize' | 'fitToBounds' | 'scale'> = {
    getViewportSize: () => [800, 600],
    fitToBounds: vi.fn(),
    scale: 1
  }
) {
  const graph = new LGraph()
  const source = createTestNode(graph, [], ['number'], 'Load Checkpoint')
  const targets = ['Positive', 'Negative'].map((title, index) => {
    const target = createTestNode(graph, ['number'], [], title)
    target.pos = [400, index * 200]
    target.updateArea()
    return target
  })
  for (const target of targets) source.connect(0, target, 0)
  const canvas = createMockCanvas({ graph, ds, animateToBounds: vi.fn() })
  useCanvasStore().canvas = canvas
  return { graph, source, targets, canvas }
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

function renderButton() {
  const user = userEvent.setup()
  render(LinkDestinationButton, { global: { plugins: [i18n] } })
  return { user }
}

describe('LinkDestinationButton', () => {
  it.for([
    { name: 'type', type: 'Example', expected: 'Go to Example' },
    { name: 'id', type: '', expected: undefined }
  ])('names a node without a title by its $name', ({ type, expected }) => {
    const { graph, source, targets } = createWorkflow()
    source.title = ''
    source.type = type
    clickSocket(graph, targets[0], 'input')

    renderButton()

    expect(
      screen.getByRole('button', {
        name: expected ?? `Go to #${source.id}`
      })
    ).toBeInTheDocument()
  })

  it('moves the view to the source, then offers every node its output leads to', async () => {
    const { graph, source, targets, canvas } = createWorkflow()
    clickSocket(graph, targets[0], 'input')
    const { user } = renderButton()

    await user.click(
      screen.getByRole('button', { name: 'Go to Load Checkpoint' })
    )

    expect(canvas.animateToBounds).toHaveBeenCalledWith(source.boundingRect, {
      zoom: 0,
      viewport: [0, 0, 800, 600]
    })
    expect(canvas.ds.fitToBounds).not.toHaveBeenCalled()
    const menuButton = await screen.findByRole('button', {
      name: 'Go to a linked node'
    })
    await waitFor(() => expect(menuButton).toHaveFocus())
  })

  it('lets the user choose a destination after linked nodes move', async () => {
    const { graph, source, targets, canvas } = createWorkflow()
    clickSocket(graph, source, 'output')
    const { user } = renderButton()
    targets[1].pos = [400, -200]

    await user.click(
      screen.getByRole('button', { name: 'Go to a linked node' })
    )
    const items = await screen.findAllByRole('menuitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveAccessibleName(`Negative #${targets[1].id}`)
    expect(items[1]).toHaveAccessibleName(`Positive #${targets[0].id}`)
    await user.click(items[0])

    expect(canvas.animateToBounds).toHaveBeenCalledWith(
      targets[1].boundingRect,
      expect.anything()
    )
    const backButton = await screen.findByRole('button', {
      name: 'Go to Load Checkpoint'
    })
    await waitFor(() => expect(backButton).toHaveFocus())
  })

  it.for([
    { name: 'too big to leave room for the menu', height: 520, scale: 1 },
    { name: 'too big at the current zoom', height: 300, scale: 1.7 }
  ])(
    'centres the landing socket when the node is $name',
    async ({ height, scale }) => {
      const ds = createTestDragAndScale()
      ds.scale = scale
      const { graph, source, targets, canvas } = createWorkflow(ds)
      source.size = [300, height]
      source.updateArea()
      clickSocket(graph, targets[0], 'input')
      const { user } = renderButton()

      await user.click(
        screen.getByRole('button', { name: 'Go to Load Checkpoint' })
      )

      const [x, y] = source.getOutputPos(0)
      expect(canvas.animateToBounds).toHaveBeenCalledWith(
        [x, y, 0, 0],
        expect.anything()
      )
    }
  )

  it('centres the source in the uncovered canvas at the current zoom in one step when animations are turned off', async () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    panel.consentAccepted = true
    panel.isOpen = true
    panel.setWidth(500)
    const ds = createTestDragAndScale(1000, 600)
    ds.scale = 1.7
    ds.offset = [13, 29]
    const { graph, source, targets, canvas } = createWorkflow(ds)
    useSettingStore().settingValues['Comfy.Appearance.DisableAnimations'] = true
    clickSocket(graph, targets[0], 'input')
    const { user } = renderButton()

    await user.click(
      screen.getByRole('button', { name: 'Go to Load Checkpoint' })
    )

    const [x, y, width, height] = source.boundingRect
    const [centreX, centreY] = ds.convertOffsetToCanvas([
      x + width / 2,
      y + height / 2
    ])
    expect(ds.scale).toBe(1.7)
    expect(centreX).toBeCloseTo(250)
    expect(centreY).toBeCloseTo(300)
    expect(canvas.animateToBounds).not.toHaveBeenCalled()
    expect(canvas.setDirty).toHaveBeenCalledWith(true, true)
  })

  it('centres the source immediately when the OS asks for reduced motion', async () => {
    const matchMedia = window.matchMedia.bind(window)
    vi.stubGlobal(
      'matchMedia',
      vi.fn<typeof window.matchMedia>((query) => {
        const result = matchMedia(query)
        vi.spyOn(result, 'matches', 'get').mockReturnValue(
          query === '(prefers-reduced-motion: reduce)'
        )
        return result
      })
    )
    const ds = createTestDragAndScale()
    ds.offset = [13, 29]
    const { graph, source, targets, canvas } = createWorkflow(ds)
    useSettingStore().settingValues['Comfy.Appearance.DisableAnimations'] =
      false
    clickSocket(graph, targets[0], 'input')
    const { user } = renderButton()

    await user.click(
      screen.getByRole('button', { name: 'Go to Load Checkpoint' })
    )

    const [x, y, width, height] = source.boundingRect
    const [centreX, centreY] = ds.convertOffsetToCanvas([
      x + width / 2,
      y + height / 2
    ])
    expect(centreX).toBeCloseTo(400)
    expect(centreY).toBeCloseTo(300)
    expect(canvas.animateToBounds).not.toHaveBeenCalled()
  })

  it('offers no go-to action for a marquee selection', () => {
    const { graph } = createWorkflow()
    const links = [...graph.links.values()]
    for (const link of links)
      setLinkPolyline(link, () => [
        { x: 0, y: 10 },
        { x: 100, y: 10 }
      ])
    selectLinksInMarquee({ graph, renderedPaths: links }, [40, 0, 20, 40], 50)

    renderButton()

    expect(getSelectedLinkIds(graph)).toHaveLength(2)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
