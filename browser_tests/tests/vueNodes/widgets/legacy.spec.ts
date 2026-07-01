import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { toNodeId } from '@/types/nodeId'
import type * as AppModeStoreModule from '@/stores/appModeStore'
import type * as WidgetIdModule from '@/types/widgetId'
import type { NodeId } from '@/types/nodeId'

function installLegacyWidgetScript() {
  return async (nodeId: NodeId) => {
    const srcRoot = '/src/'
    const [{ useAppModeStore }, { widgetId }] = await Promise.all([
      import(`${srcRoot}stores/appModeStore.ts`) as Promise<
        typeof AppModeStoreModule
      >,
      import(`${srcRoot}types/widgetId.ts`) as Promise<typeof WidgetIdModule>
    ])
    const graph = window.app!.graph
    const node = graph.getNodeById(nodeId)
    if (!node) throw new Error(`Node ${nodeId} not found`)

    node.widgets ??= []
    const widget = {
      draw(
        ctx: CanvasRenderingContext2D,
        _node: unknown,
        widgetWidth: number,
        y: number,
        height: number
      ) {
        ctx.save()
        ctx.fillStyle = '#7F7'
        ctx.fillRect(15, y, widgetWidth - 15 * 2, height)
        ctx.restore()
      },
      mouse(
        this: { value: number },
        event: PointerEvent,
        _position: [number, number],
        _targetNode: { size: [number, number] }
      ) {
        if (event.offsetX < 30) {
          this.value = -1
        } else if (event.offsetX > 30) {
          this.value = 0
        }
        return false
      },
      name: 'legacy_widget',
      options: {},
      type: 'DEVTOOLS.LEGACYWIDGET',
      value: 0,
      y: 0
    }
    node.widgets.push(widget)

    useAppModeStore().loadSelections({
      inputs: [
        [widgetId(graph.rootGraph.id, node.id, widget.name), widget.name]
      ],
      outputs: graph.nodes
        .filter((n) => n.type === 'SaveImage' || n.type === 'PreviewImage')
        .map((n) => n.id)
    })
  }
}

test('@vue-nodes In App Mode, widget width updates with panel size', async ({
  comfyPage,
  comfyMouse
}) => {
  let legacyNodeId = toNodeId(10)

  await test.step('setup', async () => {
    const legacyNode = await comfyPage.nodeOps.addNode(
      'DevToolsNodeWithLegacyWidget',
      undefined,
      {
        x: 0,
        y: 0
      }
    )
    legacyNodeId = legacyNode.id
    await comfyPage.page.evaluate(installLegacyWidgetScript(), legacyNodeId)
    await comfyPage.appMode.toggleAppMode()
  })

  const getWidth = async () =>
    (await comfyPage.appMode.linearWidgets.locator('canvas').boundingBox())
      ?.width ?? 0

  await test.step('Mouse clicks resolve to button regions', async () => {
    const legacyWidget = comfyPage.appMode.linearWidgets.locator('canvas')
    const { width, height } = (await legacyWidget.boundingBox())!

    const nodeRef = await comfyPage.nodeOps.getNodeRefById(legacyNodeId)
    const legacyWidgetRef = await nodeRef.getWidget(0)
    expect(await legacyWidgetRef.getValue()).toBe(0)
    await legacyWidget.click({ position: { x: 20, y: height / 2 } })
    await expect.poll(() => legacyWidgetRef.getValue()).toBe(-1)
    await legacyWidget.click({ position: { x: width - 20, y: height / 2 } })
    await expect.poll(() => legacyWidgetRef.getValue()).toBe(0)
  })

  await test.step('Resize to update width', async () => {
    await expect.poll(getWidth).toBeGreaterThan(0)
    const initialWidth = await getWidth()

    const gutter = comfyPage.page.getByRole('separator')

    await expect(gutter).toBeVisible()
    await comfyMouse.dragElementBy(gutter, { x: -200 })
    await expect.poll(getWidth).toBeGreaterThan(initialWidth)
    const intermediateWidth = await getWidth()

    await comfyMouse.dragElementBy(gutter, { x: 100 })
    await expect.poll(getWidth).toBeLessThan(intermediateWidth)
  })
})
