import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { toNodeId } from '@/types/nodeId'

test.afterEach(async ({ comfyPage }) => {
  await comfyPage.workflow.loadWorkflow('default')
})

for (const vueNodesEnabled of [false, true] as const) {
  const renderer = vueNodesEnabled ? 'Vue' : 'legacy'

  test(
    `linking a same-name non-widget socket keeps the ${renderer} button usable`,
    { tag: ['@canvas', '@node', '@widget'] },
    async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.VueNodes.Enabled',
        vueNodesEnabled
      )
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
      if (vueNodesEnabled) await comfyPage.vueNodes.waitForNodes()
      else {
        await comfyPage.page.evaluate((id) => {
          const node = window.app!.graph.getNodeById(id)!
          const drawWidgets = node.drawWidgets
          node.properties.drawFrames = 0
          node.drawWidgets = function (ctx, options) {
            let labels = 0
            const fillText = ctx.fillText
            ctx.fillText = function (text, ...args) {
              fillText.call(this, text, ...args)
              if (text === 'model') labels++
            }
            try {
              drawWidgets.call(this, ctx, options)
              node.properties.drawnModelLabels = labels
              node.properties.drawFrames =
                Number(node.properties.drawFrames) + 1
            } finally {
              ctx.fillText = fillText
            }
          }
        }, consumerId)
      }
      const control = vueNodesEnabled
        ? comfyPage.vueNodes
            .getNodeLocator(consumerId)
            .getByRole('button', { name: 'model', exact: true })
        : null
      const clicks = () =>
        comfyPage.page.evaluate(
          (id) => window.app!.graph.getNodeById(id)!.properties.clicks,
          consumerId
        )
      const sourceRowCount = () =>
        comfyPage.page.evaluate(
          (id) =>
            window
              .app!.graph.getNodeById(id)!
              .widgets?.filter((widget) => widget.name === 'model').length ?? 0,
          consumerId
        )
      const consumer = await comfyPage.nodeOps.getNodeRefById(consumerId)
      const legacyControl = await consumer.getWidgetByName('model')
      const legacyControlCenter = async () => {
        const position = await legacyControl.getPosition()
        return { x: position.x, y: position.y + 10 }
      }
      const expectLegacyControlDrawn = async () => {
        const beforeFrame = await comfyPage.page.evaluate((id) => {
          const node = window.app!.graph.getNodeById(id)!
          node.setDirtyCanvas(true, true)
          return Number(node.properties.drawFrames)
        }, consumerId)
        await expect
          .poll(() =>
            comfyPage.page.evaluate((id) => {
              const node = window.app!.graph.getNodeById(id)!
              return Number(node.properties.drawFrames)
            }, consumerId)
          )
          .toBeGreaterThan(beforeFrame)
        expect(
          await comfyPage.page.evaluate(
            (id) =>
              window.app!.graph.getNodeById(id)!.properties.drawnModelLabels,
            consumerId
          )
        ).toBe(1)
        const position = await legacyControlCenter()
        const distinctColors = await comfyPage.canvas.evaluate(
          (canvas: HTMLCanvasElement, { x, y }) => {
            const rect = canvas.getBoundingClientRect()
            const scaleX = canvas.width / rect.width
            const scaleY = canvas.height / rect.height
            const pixels = canvas
              .getContext('2d')!
              .getImageData(
                Math.round((x - rect.left - 50) * scaleX),
                Math.round((y - rect.top - 8) * scaleY),
                Math.round(100 * scaleX),
                Math.round(16 * scaleY)
              ).data
            const colors = new Set<string>()
            for (let index = 0; index < pixels.length; index += 4) {
              colors.add(
                `${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`
              )
            }
            return colors.size
          },
          position
        )
        expect(distinctColors).toBeGreaterThan(1)
      }
      const expectControlUsable = async (expectedClicks: number) => {
        await expect.poll(sourceRowCount).toBe(1)
        if (control) {
          await expect(control).toHaveCount(1)
          await expect(control).toBeVisible()
          await expect(control).toBeEnabled()
          await control.click()
        } else {
          await expectLegacyControlDrawn()
          const position = await legacyControlCenter()
          await comfyPage.page.mouse.click(position.x, position.y)
          await comfyPage.nextFrame()
        }
        await expect.poll(clicks).toBe(expectedClicks)
      }

      await expectControlUsable(1)

      const producer = await comfyPage.nodeOps.getNodeRefById(producerId)
      await producer.connectOutput(0, consumer, 0)
      await expect
        .poll(() => consumer.getInput(0).then((input) => input.getLinkCount()))
        .toBe(1)
      await expectControlUsable(2)
    }
  )
}
