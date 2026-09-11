import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Link interaction at browser zoom', { tag: '@canvas' }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => {
      document.body.style.zoom = ''
    })
  })

  test('disconnects and reconnects the exact endpoint at 150 percent', async ({
    comfyPage
  }) => {
    test.slow()
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.page.evaluate(() => {
      document.body.style.zoom = '1.5'
    })
    await comfyPage.nextFrame()

    const positions = await comfyPage.page.evaluate(() => {
      const graph = window.app!.graph
      const checkpoint = graph.nodes.find((node) => String(node.id) === '4')!
      const prompt = graph.nodes.find((node) => String(node.id) === '6')!
      const output = window.app!.canvasPosToClientPos(
        checkpoint.getConnectionPos(false, 1)
      )
      const input = window.app!.canvasPosToClientPos(
        prompt.getConnectionPos(true, 0)
      )
      return { input, output }
    })
    const scaled = ([x, y]: number[]) => ({ x: x * 1.5, y: y * 1.5 })

    await comfyPage.canvasOps.dragAndDrop(
      scaled(positions.input),
      scaled([800, 100])
    )
    await expect
      .poll(() =>
        comfyPage.page.evaluate(
          () =>
            window.app!.graph.nodes.find((node) => String(node.id) === '6')!
              .inputs[0].link
        )
      )
      .toBeNull()

    await comfyPage.canvasOps.dragAndDrop(
      scaled(positions.output),
      scaled(positions.input)
    )
    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => {
          const graph = window.app!.graph
          const prompt = graph.nodes.find((node) => String(node.id) === '6')!
          const link = graph.links.get(prompt.inputs[0].link!)
          return {
            originId: String(link?.origin_id),
            targetId: String(link?.target_id)
          }
        })
      )
      .toEqual({ originId: '4', targetId: '6' })
    const checkpoint = await comfyPage.nodeOps.getNodeRefById(4)
    await (await checkpoint.getOutput(1)).expectLinkCount(2)
  })
})
