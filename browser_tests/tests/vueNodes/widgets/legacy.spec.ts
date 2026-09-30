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

test('@vue-nodes In App Mode, legacy widget host geometry stays transient', async ({
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
  })

  const getGeometry = () =>
    comfyPage.page.evaluate((nodeId) => {
      const node = window.app!.rootGraph.getNodeById(nodeId)
      const widget = node?.widgets?.find(
        (widget) => widget.name === 'legacy_widget'
      )
      return {
        hasOwnWidth: widget ? Object.hasOwn(widget, 'width') : false,
        width: widget?.width ?? null,
        y: widget?.y ?? null,
        canvasHeight:
          (node as typeof node & { canvasHeight?: number }).canvasHeight ?? null
      }
    }, legacyNodeId)

  const initialGeometry = await getGeometry()

  await comfyPage.appMode.enterAppModeWithInputs([
    [String(legacyNodeId), 'legacy_widget']
  ])

  const legacyWidget = comfyPage.appMode.linearWidgets.locator('canvas')
  const nodeRef = await comfyPage.nodeOps.getNodeRefById(legacyNodeId)
  const legacyWidgetRef = await nodeRef.getWidget(0)

  await test.step('Mouse clicks resolve to host button regions', async () => {
    await expect(legacyWidget).toBeVisible()
    const { width, height } = (await legacyWidget.boundingBox())!

    expect(await legacyWidgetRef.getValue()).toBe(0)

    await legacyWidget.click({ position: { x: 20, y: height / 2 } })
    await expect.poll(() => legacyWidgetRef.getValue()).toBe(-1)

    await legacyWidget.click({ position: { x: width - 20, y: height / 2 } })
    await expect.poll(() => legacyWidgetRef.getValue()).toBe(0)

    await expect.poll(getGeometry).toEqual(initialGeometry)
  })

  await test.step('Panel resize changes host geometry without persisting it', async () => {
    const initialRenderedWidth = (await legacyWidget.boundingBox())!.width
    const gutter = comfyPage.page.getByRole('separator')

    await expect(gutter).toBeVisible()
    await comfyMouse.dragElementBy(gutter, { x: -200 })

    await expect
      .poll(async () => (await legacyWidget.boundingBox())?.width ?? 0)
      .toBeGreaterThan(initialRenderedWidth)

    await expect.poll(getGeometry).toEqual(initialGeometry)

    const intermediateRenderedWidth = (await legacyWidget.boundingBox())!.width
    const { width, height } = (await legacyWidget.boundingBox())!

    await legacyWidget.click({ position: { x: width - 20, y: height / 2 } })
    await expect.poll(() => legacyWidgetRef.getValue()).toBe(1)
    await expect.poll(getGeometry).toEqual(initialGeometry)

    await comfyMouse.dragElementBy(gutter, { x: 100 })

    await expect
      .poll(async () => (await legacyWidget.boundingBox())?.width ?? 0)
      .toBeLessThan(intermediateRenderedWidth)

    await expect.poll(getGeometry).toEqual(initialGeometry)
  })
})

test('@vue-nodes Properties panel does not persist legacy widget host geometry', async ({
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
  })

  const getGeometry = () =>
    comfyPage.page.evaluate((nodeId) => {
      const node = window.app!.rootGraph.getNodeById(nodeId)
      const widget = node?.widgets?.find(
        (widget) => widget.name === 'legacy_widget'
      )
      return {
        hasOwnWidth: widget ? Object.hasOwn(widget, 'width') : false,
        width: widget?.width ?? null,
        y: widget?.y ?? null,
        canvasHeight:
          (node as typeof node & { canvasHeight?: number }).canvasHeight ?? null
      }
    }, legacyNodeId)

  const initialGeometry = await getGeometry()
  const nodeRef = await comfyPage.nodeOps.getNodeRefById(legacyNodeId)
  const legacyWidgetRef = await nodeRef.getWidget(0)

  await comfyPage.actionbar.propertiesButton.click()
  await comfyPage.nodeOps.selectNodes(['Node With Legacy Widget'])

  const legacyWidget = comfyPage.page
    .getByTestId(TestIds.propertiesPanel.root)
    .locator('canvas')

  await expect(legacyWidget).toBeVisible()
  await expect.poll(getGeometry).toEqual(initialGeometry)

  const { width, height } = (await legacyWidget.boundingBox())!

  expect(await legacyWidgetRef.getValue()).toBe(0)

  await legacyWidget.click({ position: { x: width - 20, y: height / 2 } })
  await expect.poll(() => legacyWidgetRef.getValue()).toBe(1)

  await expect.poll(getGeometry).toEqual(initialGeometry)
})
