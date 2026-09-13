import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { toNodeId } from '@/types/nodeId'

test.describe(
  'Legacy converted storage widget',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.nodeOps.clearGraph()
    })

    test('keeps its input socket and serialized value while hiding its control', async ({
      comfyPage
    }) => {
      const nodeId = toNodeId(
        await comfyPage.page.evaluate(() => {
          const node = window.LiteGraph!.createNode('Note')!
          node.title = 'SAM3 storage emulator'
          node.pos = [400, 200]

          const widget = node.addWidget('text', 'points_store', '', () => {})
          node.addInput('points_store', 'STRING', {
            widget: { name: widget.name }
          })
          node.serialize_widgets = true

          widget.value = '{"positive":[[120,80]],"negative":[]}'
          widget.computeSize = () => [0, -4]
          widget.type = 'converted-widget'
          widget.hidden = true

          window.app!.graph.add(node)
          return String(node.id)
        })
      )
      await comfyPage.nextFrame()

      await expect(
        comfyPage.vueNodes.getInputSlotConnectionDot(nodeId, 0)
      ).toBeVisible()
      await expect(
        comfyPage.vueNodes.getWidgetByName(
          'SAM3 storage emulator',
          'points_store'
        )
      ).toHaveCount(0)
      await expect
        .poll(() =>
          comfyPage.page.evaluate((id) => {
            return window.app!.graph.getNodeById(id)?.serialize()
              .widgets_values_named?.points_store
          }, nodeId)
        )
        .toBe('{"positive":[[120,80]],"negative":[]}')
    })
  }
)
