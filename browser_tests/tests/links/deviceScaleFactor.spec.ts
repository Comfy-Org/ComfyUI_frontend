import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.use({ deviceScaleFactor: 1.5 })

const renderers = [
  { name: 'legacy', vueNodes: false },
  { name: 'Vue', vueNodes: true }
] as const

test.describe(
  'Link interaction at emulated display scaling',
  { tag: '@canvas' },
  () => {
    let previousAction: string | undefined
    let previousRenderer: boolean | undefined

    test.beforeEach(async ({ comfyPage }) => {
      previousAction = undefined
      previousRenderer = undefined
      previousAction = await comfyPage.settings.getSetting<string>(
        'Comfy.LinkRelease.Action'
      )
      previousRenderer = await comfyPage.settings.getSetting<boolean>(
        'Comfy.VueNodes.Enabled'
      )
    })

    test.afterEach(async ({ comfyPage }) => {
      if (previousAction !== undefined) {
        await comfyPage.settings.setSetting(
          'Comfy.LinkRelease.Action',
          previousAction
        )
      }
      if (previousRenderer !== undefined) {
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          previousRenderer
        )
      }
    })

    for (const renderer of renderers) {
      test(`disconnects and reconnects the exact endpoint at 150 percent in the ${renderer.name} renderer`, async ({
        comfyPage
      }) => {
        test.slow()
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          renderer.vueNodes
        )
        await comfyPage.workflow.loadWorkflow('default')
        await comfyPage.settings.setSetting(
          'Comfy.LinkRelease.Action',
          'no action'
        )
        expect(
          await comfyPage.page.evaluate(() => window.devicePixelRatio)
        ).toBe(1.5)

        const positions = await comfyPage.page.evaluate(() => {
          const graph = window.app!.graph
          const checkpoint = graph.nodes.find(
            (node) => String(node.id) === '4'
          )!
          const prompt = graph.nodes.find((node) => String(node.id) === '6')!
          const output = window.app!.canvasPosToClientPos(
            checkpoint.getConnectionPos(false, 1)
          )
          const input = window.app!.canvasPosToClientPos(
            prompt.getConnectionPos(true, 0)
          )
          return { input, output }
        })
        const clientPosition = ([x, y]: number[]) => ({ x, y })

        await comfyPage.canvasOps.dragAndDrop(clientPosition(positions.input), {
          x: 800,
          y: 100
        })
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
          clientPosition(positions.output),
          clientPosition(positions.input)
        )
        await expect
          .poll(() =>
            comfyPage.page.evaluate(() => {
              const graph = window.app!.graph
              const prompt = graph.nodes.find(
                (node) => String(node.id) === '6'
              )!
              const link = graph.links.get(prompt.inputs[0].link!)
              return {
                originId: String(link?.origin_id),
                originSlot: link?.origin_slot,
                targetId: String(link?.target_id),
                targetSlot: link?.target_slot
              }
            })
          )
          .toEqual({
            originId: '4',
            originSlot: 1,
            targetId: '6',
            targetSlot: 0
          })
        const checkpoint = await comfyPage.nodeOps.getNodeRefById(4)
        await (await checkpoint.getOutput(1)).expectLinkCount(2)
      })
    }
  }
)
