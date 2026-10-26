import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import LinkSelectionActions from '@/components/graph/selectionToolbox/LinkSelectionActions.vue'
import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import type { DragAndScale } from '@/lib/litegraph/src/DragAndScale'
import {
  selectLinksInMarquee,
  selectSlotLinks
} from '@/lib/litegraph/src/canvas/linkSelection'
import { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LinkRenderType } from '@/lib/litegraph/src/types/globalEnums'
import enCommands from '@/locales/en/commands.json' with { type: 'json' }
import enMain from '@/locales/en/main.json' with { type: 'json' }
import { useSettingStore } from '@/platform/settings/settingStore'
import { setLinkPolyline } from '@/renderer/core/canvas/linkPolylines'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import {
  createMockCanvas,
  createTestDragAndScale
} from '@/utils/__tests__/canvasTestUtils'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { ...enMain, commands: enCommands } }
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
  const links = targets.map((target) => {
    const link = source.connect(0, target, 0)
    if (!link) throw new Error('connect failed')
    return link
  })
  const canvas = createMockCanvas({ graph, ds, animateToBounds: vi.fn() })
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
  it('names a node without a title by its type', () => {
    const { graph, source, targets } = createWorkflow()
    source.title = ''
    clickSocket(graph, targets[0], 'input')

    renderActions()

    expect(
      screen.getByRole('button', { name: `Go to ${source.type}` })
    ).toBeInTheDocument()
  })

  it('names a node without a title or type by its id', () => {
    const { graph, source, targets } = createWorkflow()
    source.title = ''
    source.type = ''
    clickSocket(graph, targets[0], 'input')

    renderActions()

    expect(
      screen.getByRole('button', { name: `Go to #${source.id}` })
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
    expect(canvas.ds.fitToBounds).not.toHaveBeenCalled()
    expect(canvas.setDirty).not.toHaveBeenCalled()
    const menuButton = await screen.findByRole('button', {
      name: 'Go to a linked node'
    })
    await waitFor(() => expect(menuButton).toHaveFocus())
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
    const backButton = await screen.findByRole('button', {
      name: 'Go to Load Checkpoint'
    })
    await waitFor(() => expect(backButton).toHaveFocus())
  })

  it('lists the linked nodes in their new order after one moves', async () => {
    const { graph, source, targets } = createWorkflow()
    clickSocket(graph, source, 'output')
    const { user } = renderActions()

    targets[1].pos = [400, -200]
    await user.click(
      screen.getByRole('button', { name: 'Go to a linked node' })
    )

    const items = await screen.findAllByRole('menuitem')
    expect(items[0]).toHaveAccessibleName(`Negative #${targets[1].id}`)
    expect(items[1]).toHaveAccessibleName(`Positive #${targets[0].id}`)
  })

  it.for([
    { name: 'bigger than the view', height: 2000 },
    { name: 'too big to leave room for the menu', height: 520 }
  ])(
    'centres the landing socket when the node is $name',
    async ({ height }) => {
      const { graph, source, targets, canvas } = createWorkflow()
      source.size = [300, height]
      source.updateArea()
      clickSocket(graph, targets[0], 'input')
      const { user } = renderActions()

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

  it('centres the source at the current zoom in one step when animations are turned off', async () => {
    const ds = createTestDragAndScale()
    ds.scale = 1.7
    ds.offset = [13, 29]
    const { graph, source, targets, canvas } = createWorkflow(ds)
    useSettingStore().settingValues['Comfy.Appearance.DisableAnimations'] = true
    clickSocket(graph, targets[0], 'input')
    const { user } = renderActions()

    await user.click(
      screen.getByRole('button', { name: 'Go to Load Checkpoint' })
    )

    const [x, y, width, height] = source.boundingRect
    const [centreX, centreY] = ds.convertOffsetToCanvas([
      x + width / 2,
      y + height / 2
    ])
    expect(ds.scale).toBe(1.7)
    expect(centreX).toBeCloseTo(400)
    expect(centreY).toBeCloseTo(300)
    expect(canvas.animateToBounds).not.toHaveBeenCalled()
    expect(canvas.setDirty).toHaveBeenCalledWith(true, true)
  })

  it('moves the view in one step when the OS asks for reduced motion', async () => {
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
    const { graph, source, targets, canvas } = createWorkflow()
    useSettingStore().settingValues['Comfy.Appearance.DisableAnimations'] =
      false
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
