import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { toNodeId } from '@/types/nodeId'

test('@vue-nodes In App Mode, legacy widget host geometry stays transient', async ({
  comfyPage,
  comfyMouse
}) => {
  await comfyPage.nodeOps.addNode('DevToolsNodeWithLegacyWidget', undefined, {
    x: 0,
    y: 0
  })

  const getGeometry = () =>
    comfyPage.page.evaluate(
      (nodeId) => {
        const widget = graph!.getNodeById(nodeId)!.widgets![0]
        return {
          width: widget.width ?? null,
          y: widget.y ?? null
        }
      },
      toNodeId(10)
    )

  const initialGeometry = await getGeometry()
  await comfyPage.appMode.enterAppModeWithInputs([['10', 'legacy_widget']])

  const legacyWidget = comfyPage.appMode.linearWidgets.locator('canvas')
  const nodeRef = await comfyPage.nodeOps.getNodeRefById(10)
  const legacyWidgetRef = await nodeRef.getWidget(0)

  await test.step('Mouse clicks resolve to host button regions', async () => {
    const { width, height } = (await legacyWidget.boundingBox())!

    expect(await legacyWidgetRef.getValue()).toBe(0)
    await legacyWidget.click({ position: { x: 20, y: height / 2 } })
    await expect.poll(() => legacyWidgetRef.getValue()).toBe(-1)
    await legacyWidget.click({ position: { x: width - 20, y: height / 2 } })
    await expect.poll(() => legacyWidgetRef.getValue()).toBe(0)
    await expect.poll(getGeometry).toEqual(initialGeometry)
  })

  await test.step('Panel resize changes host geometry without persisting it', async () => {
    const initialWidth = (await legacyWidget.boundingBox())!.width
    const gutter = comfyPage.page.getByRole('separator')

    await expect(gutter).toBeVisible()
    await comfyMouse.dragElementBy(gutter, { x: -200 })

    await expect
      .poll(async () => (await legacyWidget.boundingBox())?.width ?? 0)
      .toBeGreaterThan(initialWidth)
    await expect.poll(getGeometry).toEqual(initialGeometry)

    const { width, height } = (await legacyWidget.boundingBox())!
    await legacyWidget.click({ position: { x: width - 20, y: height / 2 } })
    await expect.poll(() => legacyWidgetRef.getValue()).toBe(1)
    await expect.poll(getGeometry).toEqual(initialGeometry)
  })
})

test('@vue-nodes Properties panel does not persist legacy widget host geometry', async ({
  comfyPage
}) => {
  await comfyPage.nodeOps.addNode('DevToolsNodeWithLegacyWidget', undefined, {
    x: 0,
    y: 0
  })

  const getGeometry = () =>
    comfyPage.page.evaluate(
      (nodeId) => {
        const widget = graph!.getNodeById(nodeId)!.widgets![0]
        return {
          width: widget.width ?? null,
          y: widget.y ?? null
        }
      },
      toNodeId(10)
    )

  const initialGeometry = await getGeometry()
  const nodeRef = await comfyPage.nodeOps.getNodeRefById(10)
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
