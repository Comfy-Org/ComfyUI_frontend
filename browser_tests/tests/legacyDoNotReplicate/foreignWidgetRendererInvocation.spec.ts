import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { toNodeId } from '@/types/nodeId'

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
