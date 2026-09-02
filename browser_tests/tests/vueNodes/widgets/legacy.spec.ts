import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { toNodeId } from '@/types/nodeId'

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
  }
)

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

    const gutter = comfyPage.page.getByRole('separator')

    await expect(gutter).toBeVisible()
    await comfyMouse.dragElementBy(gutter, { x: -200 })
    await expect.poll(getRenderedWidth).toBeGreaterThan(initialRenderedWidth)
    await expect.poll(getWidgetWidth).toBeGreaterThan(initialWidgetWidth)
    const intermediateRenderedWidth = await getRenderedWidth()
    const intermediateWidgetWidth = await getWidgetWidth()

    await comfyMouse.dragElementBy(gutter, { x: 100 })
    await expect.poll(getRenderedWidth).toBeLessThan(intermediateRenderedWidth)
    await expect.poll(getWidgetWidth).toBeLessThan(intermediateWidgetWidth)
  })
})
