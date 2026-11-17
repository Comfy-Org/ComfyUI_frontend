import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const HOST_A = '5'
const HOST_B = '6'

function previewSrcsByHost(comfyPage: ComfyPage) {
  return comfyPage.page
    .getByTestId(new RegExp(`^node-body-(${HOST_A}|${HOST_B})$`))
    .evaluateAll((bodies) =>
      Object.fromEntries(
        bodies.map((body) => [
          body.dataset.testid,
          Array.from(body.querySelectorAll('img'), (image) =>
            image.getAttribute('src')
          )
        ])
      )
    )
}

test.describe(
  'Subgraph shared-definition previews',
  { tag: ['@subgraph', '@vue-nodes'] },
  () => {
    test('Running two copies of one subgraph shows each copy the image it saved', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/shared-definition-two-hosts-save-image'
      )

      await comfyPage.runButton.click()

      await expect
        .poll(() => previewSrcsByHost(comfyPage), { timeout: 30_000 })
        .toEqual({
          [`node-body-${HOST_A}`]: [expect.stringMatching(/hostA_\d+_/)],
          [`node-body-${HOST_B}`]: [expect.stringMatching(/hostB_\d+_/)]
        })
    })

    test('A bypassed copy of a subgraph shows no image after the other copy runs', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/shared-definition-two-hosts-save-image'
      )
      await comfyPage.vueNodes.selectNode(HOST_B)
      await comfyPage.keyboard.bypass()

      await comfyPage.runButton.click()

      await expect
        .poll(() => previewSrcsByHost(comfyPage), { timeout: 30_000 })
        .toEqual({
          [`node-body-${HOST_A}`]: [expect.stringMatching(/hostA_\d+_/)],
          [`node-body-${HOST_B}`]: []
        })
    })

    test('Each copy of a subgraph shows its own live preview while it runs', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/shared-definition-two-hosts-live-preview'
      )

      await comfyPage.runButton.click()

      await expect
        .poll(
          async () => {
            const srcs = await previewSrcsByHost(comfyPage)
            const hostA = srcs[`node-body-${HOST_A}`] ?? []
            const hostB = srcs[`node-body-${HOST_B}`] ?? []
            return {
              bothLive: [...hostA, ...hostB].every((src) =>
                src?.startsWith('blob:')
              ),
              counts: [hostA.length, hostB.length],
              distinct: hostA[0] !== hostB[0]
            }
          },
          { timeout: 30_000 }
        )
        .toEqual({ bothLive: true, counts: [1, 1], distinct: true })
    })

    test('A deleted copy of a subgraph brought back with undo shows no image until it runs again', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/shared-definition-two-hosts-save-image'
      )
      await comfyPage.runButton.click()
      await expect
        .poll(() => previewSrcsByHost(comfyPage), { timeout: 30_000 })
        .toEqual({
          [`node-body-${HOST_A}`]: [expect.stringMatching(/hostA_\d+_/)],
          [`node-body-${HOST_B}`]: [expect.stringMatching(/hostB_\d+_/)]
        })

      await comfyPage.vueNodes.deleteNode(HOST_B)
      await expect(comfyPage.vueNodes.getNodeLocator(HOST_B)).toHaveCount(0)
      await expect
        .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
        .toBe(true)
      await comfyPage.keyboard.undo()
      await expect(comfyPage.vueNodes.getNodeLocator(HOST_B)).toHaveCount(1)
      await expect
        .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
        .toBe(false)

      expect(
        (await previewSrcsByHost(comfyPage))[`node-body-${HOST_B}`]
      ).toEqual([])

      await comfyPage.runButton.click()
      await expect
        .poll(
          async () =>
            (await previewSrcsByHost(comfyPage))[`node-body-${HOST_B}`],
          { timeout: 30_000 }
        )
        .toEqual([expect.stringMatching(/hostB_\d+_/)])
    })

    test('Promoting the saved image onto both copies of a subgraph shows each copy its own image', async ({
      comfyPage
    }) => {
      const filenamePrefixOnly = {
        properties: {
          proxyWidgets: [['10', 'filename_prefix']],
          previewExposures: []
        }
      }
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/shared-definition-two-hosts-save-image',
        {
          nodes: { [HOST_A]: filenamePrefixOnly, [HOST_B]: filenamePrefixOnly }
        }
      )
      const { editor } = comfyPage.subgraph
      for (const host of [HOST_A, HOST_B]) {
        await editor.togglePromotion(comfyPage.vueNodes.getNodeLocator(host), {
          nodeId: '10',
          widgetName: '$$canvas-image-preview',
          toState: true
        })
      }

      await comfyPage.runButton.click()

      await expect
        .poll(() => previewSrcsByHost(comfyPage), { timeout: 30_000 })
        .toEqual({
          [`node-body-${HOST_A}`]: [expect.stringMatching(/hostA_\d+_/)],
          [`node-body-${HOST_B}`]: [expect.stringMatching(/hostB_\d+_/)]
        })
    })
  }
)
