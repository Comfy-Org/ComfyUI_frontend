import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { toNodeId } from '@/types/nodeId'

test(
  'linking a same-name non-widget socket keeps the Vue button usable',
  { tag: ['@canvas', '@node', '@widget'] },
  async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.menu.topbar.newWorkflowButton.click()
    const producerId = toNodeId('same-name-producer')
    const consumerId = toNodeId('same-name-consumer')
    await comfyPage.page.evaluate(
      ([producerId, consumerId]) => {
        const producer = window.LiteGraph!.createNode('Note')!
        producer.id = producerId
        producer.pos = [100, 100]
        producer.addOutput('model', 'MODEL')
        const consumer = window.LiteGraph!.createNode('Note')!
        consumer.id = consumerId
        consumer.pos = [500, 100]
        consumer.addInput('model', 'MODEL')
        consumer.properties.clicks = 0
        consumer.addWidget('button', 'model', undefined, () => {
          consumer.properties.clicks = Number(consumer.properties.clicks) + 1
        })
        window.app!.graph.add(producer)
        window.app!.graph.add(consumer)
      },
      [producerId, consumerId] as const
    )
    await comfyPage.vueNodes.waitForNodes()
    const control = comfyPage.vueNodes
      .getNodeLocator(consumerId)
      .getByRole('button', { name: 'model', exact: true })
    const clicks = () =>
      comfyPage.page.evaluate(
        (id) => window.app!.graph.getNodeById(id)!.properties.clicks,
        consumerId
      )

    await expect(control).toHaveCount(1)
    await expect(control).toBeVisible()
    await control.click()
    await expect.poll(clicks).toBe(1)

    const producer = await comfyPage.nodeOps.getNodeRefById(producerId)
    const consumer = await comfyPage.nodeOps.getNodeRefById(consumerId)
    await producer.connectOutput(0, consumer, 0)
    await expect
      .poll(() => consumer.getInput(0).then((input) => input.getLinkCount()))
      .toBe(1)
    await expect(control).toHaveCount(1)
    await expect(control).toBeVisible()
    await expect(control).toBeEnabled()
    await control.click()
    await expect.poll(clicks).toBe(2)
  }
)
