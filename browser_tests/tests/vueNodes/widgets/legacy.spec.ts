import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
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

for (const vueNodesEnabled of [false, true] as const) {
  const renderer = vueNodesEnabled ? 'Vue' : 'classic'
  const tag = vueNodesEnabled
    ? ['@vue-nodes', '@widget']
    : ['@canvas', '@widget']

  test.describe(`Foreign legacy widget (${renderer})`, { tag }, () => {
    test('invokes prototype behavior from rendering and pointer input', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.VueNodes.Enabled',
        vueNodesEnabled
      )
      await comfyPage.nodeOps.clearGraph()
      const addForeignWidget = () => {
        class ForeignLegacyWidget implements IBaseWidget {
          [symbol: symbol]: boolean
          name = 'foreign_legacy_widget'
          type = 'foreign_legacy_test'
          value = 0
          options = {}
          y = 0
          drawCalls = 0
          mouseCalls = 0
          computeSizeCalls = 0

          draw() {
            this.drawCalls++
          }

          mouse() {
            this.mouseCalls++
            return true
          }

          computeSize(): [number, number] {
            this.computeSizeCalls++
            return [160, 24]
          }
        }

        const node = window.LiteGraph!.createNode('Note')!
        node.title = 'Foreign legacy widget'
        node.pos = [400, 200]
        window.app!.graph.add(node)
        node.addCustomWidget(new ForeignLegacyWidget())
        return String(node.id)
      }
      const nodeId = toNodeId(await comfyPage.page.evaluate(addForeignWidget))

      const counters = () =>
        comfyPage.page.evaluate((id) => {
          const widget = window
            .app!.graph.getNodeById(id)
            ?.widgets?.find(
              (candidate) => candidate.name === 'foreign_legacy_widget'
            )
          return {
            draw:
              widget &&
              'drawCalls' in widget &&
              typeof widget.drawCalls === 'number'
                ? widget.drawCalls
                : 0,
            mouse:
              widget &&
              'mouseCalls' in widget &&
              typeof widget.mouseCalls === 'number'
                ? widget.mouseCalls
                : 0,
            computeSize:
              widget &&
              'computeSizeCalls' in widget &&
              typeof widget.computeSizeCalls === 'number'
                ? widget.computeSizeCalls
                : 0
          }
        }, nodeId)

      await expect.poll(async () => (await counters()).draw).toBeGreaterThan(0)
      await expect
        .poll(async () => (await counters()).computeSize)
        .toBeGreaterThan(0)

      if (vueNodesEnabled) {
        await comfyPage.vueNodes
          .getNodeLocator(nodeId)
          .getByTestId(TestIds.widgets.widget)
          .locator('canvas')
          .click()
      } else {
        const node = await comfyPage.nodeOps.getNodeRefById(nodeId)
        await (await node.getWidgetByName('foreign_legacy_widget')).click()
      }

      await expect.poll(async () => (await counters()).mouse).toBeGreaterThan(0)
    })
  })
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
