import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

test.describe(
  'Plain legacy widgets',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test('renders widgets added through legacy APIs and direct mutation', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.clearGraph()
      const nodeId = toNodeId(
        await comfyPage.page.evaluate(() => {
          const node = window.LiteGraph!.createNode(
            'DevToolsNodeWithLegacyWidget',
            undefined,
            { pos: [400, 200] }
          )!
          window.app!.graph.add(node)
          node.addCustomWidget({
            name: 'after_attach',
            type: 'legacy_test',
            value: 0,
            options: {},
            y: 0,
            draw() {}
          })
          node.widgets!.push({
            name: 'direct_push',
            type: 'legacy_test',
            value: 0,
            options: {},
            y: 0,
            draw() {}
          })
          return String(node.id)
        })
      )

      await expect
        .poll(() =>
          comfyPage.page.evaluate((id) => {
            const node = window.app!.graph.getNodeById(id)
            return (
              node?.widgets?.filter((widget) =>
                ['legacy_widget', 'after_attach', 'direct_push'].includes(
                  widget.name
                )
              ).length ?? 0
            )
          }, nodeId)
        )
        .toBe(3)

      const node = comfyPage.vueNodes.getNodeLocator(nodeId)
      await expect(
        node.getByTestId(TestIds.widgets.widget).locator('canvas')
      ).toHaveCount(3)
    })

    test('repaints when a legacy widget mutates its value and marks the canvas dirty', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.clearGraph()
      const legacyNode = await comfyPage.nodeOps.addNode(
        'DevToolsNodeWithLegacyWidget',
        undefined,
        { x: 400, y: 200 }
      )
      const canvas = comfyPage.vueNodes
        .getNodeLocator(legacyNode.id)
        .getByTestId(TestIds.widgets.legacyCanvas)
      await expect(canvas).toBeVisible()

      const readCenterPixel = () =>
        canvas.evaluate((element: HTMLCanvasElement) => {
          const { data } = element
            .getContext('2d')!
            .getImageData(element.width / 2, element.height / 2, 1, 1)
          return Array.from(data).join(',')
        })
      const green = '119,255,119,255'
      const blue = '119,119,255,255'
      const red = '255,119,119,255'
      await expect.poll(readCenterPixel).toBe(green)

      await test.step('click through the legacy mouse handler', async () => {
        const { height } = (await canvas.boundingBox())!
        await canvas.click({ position: { x: 20, y: height / 2 } })
        await expect.poll(readCenterPixel).toBe(blue)
      })

      await test.step('mutate the value outside any pointer event', async () => {
        await comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.graph.getNodeById(nodeId)!
          const widget = node.widgets!.find(
            (widget) => widget.name === 'legacy_widget'
          )!
          widget.value = 1
          node.setDirtyCanvas(true)
        }, legacyNode.id)
        await expect.poll(readCenterPixel).toBe(red)
      })
    })

    test('draws the widget canvas at the node width, including after a resize', async ({
      comfyPage
    }) => {
      const legacyNode = await comfyPage.nodeOps.addNode(
        'DevToolsNodeWithLegacyWidget',
        undefined,
        { x: 400, y: 200 }
      )
      const node = new VueNodeFixture(
        comfyPage.vueNodes.getNodeLocator(legacyNode.id)
      )
      const canvas = node.root.getByTestId(TestIds.widgets.legacyCanvas)
      await expect(canvas).toBeVisible()

      const widthDrift = () =>
        canvas.evaluate((element, nodeId) => {
          const node = window.app!.graph.getNodeById(nodeId)!
          const expected = node.size[0] * window.app!.canvas.ds.scale
          return element.getBoundingClientRect().width - expected
        }, legacyNode.id)

      await expect.poll(widthDrift).toBeCloseTo(0, 0)

      const initialWidth = (await canvas.boundingBox())!.width
      await node.resizeFromCorner('SE', 120, 0)
      await comfyPage.nextFrame()

      await expect
        .poll(async () => (await canvas.boundingBox())?.width ?? 0)
        .toBeGreaterThan(initialWidth + 100)
      await expect.poll(widthDrift).toBeCloseTo(0, 0)
    })

    test('ignores right clicks while left clicks still reach the widget', async ({
      comfyPage
    }) => {
      const legacyNode = await comfyPage.nodeOps.addNode(
        'DevToolsNodeWithLegacyWidget',
        undefined,
        { x: 400, y: 200 }
      )
      const canvas = comfyPage.vueNodes
        .getNodeLocator(legacyNode.id)
        .getByTestId(TestIds.widgets.legacyCanvas)
      await expect(canvas).toBeVisible()
      const { height } = (await canvas.boundingBox())!
      const widget = await legacyNode.getWidget(0)
      expect(await widget.getValue()).toBe(0)

      await canvas.click({
        button: 'right',
        position: { x: 20, y: height / 2 }
      })
      await comfyPage.nextFrame()
      expect(await widget.getValue()).toBe(0)

      await canvas.click({ position: { x: 20, y: height / 2 } })
      await expect.poll(() => widget.getValue()).toBe(-1)
    })
  }
)

test('@vue-nodes In App Mode, widget width updates with panel size', async ({
  comfyPage
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
    await comfyPage.appMode.enterAppModeWithInputs([
      [String(legacyNodeId), 'legacy_widget']
    ])
  })

  const getRenderedWidth = async () =>
    (await comfyPage.appMode.linearWidgets.locator('canvas').boundingBox())
      ?.width ?? 0
  const getWidgetWidth = () =>
    comfyPage.page.evaluate((nodeId) => {
      const widget = window
        .app!.rootGraph.getNodeById(nodeId)
        ?.widgets?.find((widget) => widget.name === 'legacy_widget')
      return widget?.width ?? 0
    }, legacyNodeId)

  await test.step('Mouse clicks resolve to button regions', async () => {
    const legacyWidget = comfyPage.appMode.linearWidgets.locator('canvas')
    await expect(legacyWidget).toBeVisible()
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
    await expect.poll(getRenderedWidth).toBeGreaterThan(0)
    await expect.poll(getWidgetWidth).toBeGreaterThan(0)
    const initialRenderedWidth = await getRenderedWidth()
    const initialWidgetWidth = await getWidgetWidth()

    await expect(comfyPage.appMode.rightPanelResizeHandle).toBeVisible()
    await comfyPage.appMode.resizeRightPanelBy(-200)
    await expect.poll(getRenderedWidth).toBeGreaterThan(initialRenderedWidth)
    await expect.poll(getWidgetWidth).toBeGreaterThan(initialWidgetWidth)
    const intermediateRenderedWidth = await getRenderedWidth()
    const intermediateWidgetWidth = await getWidgetWidth()

    await comfyPage.appMode.resizeRightPanelBy(100)
    await expect.poll(getRenderedWidth).toBeLessThan(intermediateRenderedWidth)
    await expect.poll(getWidgetWidth).toBeLessThan(intermediateWidgetWidth)
  })
})
