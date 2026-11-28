import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const HOST_A = '5'
const HOST_B = '6'

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
        .poll(() => comfyPage.vueNodes.getBodyImageSources([HOST_A, HOST_B]), {
          timeout: 30_000
        })
        .toEqual({
          [HOST_A]: [expect.stringMatching(/hostA_\d+_/)],
          [HOST_B]: [expect.stringMatching(/hostB_\d+_/)]
        })
    })

    test('Each copy of a subgraph shows its own live preview while it runs', async ({
      comfyPage,
      getWebSocket
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/shared-definition-two-hosts-save-image'
      )
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())

      const jobId = await execution.run()
      execution.latentPreview(jobId, `${HOST_A}:10`)
      execution.latentPreview(jobId, `${HOST_B}:10`)

      await expect
        .poll(async () => {
          const srcs = await comfyPage.vueNodes.getBodyImageSources([
            HOST_A,
            HOST_B
          ])
          return { ...srcs, distinct: srcs[HOST_A]?.[0] !== srcs[HOST_B]?.[0] }
        })
        .toEqual({
          [HOST_A]: [expect.stringMatching(/^blob:/)],
          [HOST_B]: [expect.stringMatching(/^blob:/)],
          distinct: true
        })
    })

    test('A deleted copy of a subgraph brought back with undo shows no image until it runs again', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/shared-definition-two-hosts-save-image'
      )
      await comfyPage.runButton.click()
      await expect
        .poll(() => comfyPage.vueNodes.getBodyImageSources([HOST_A, HOST_B]), {
          timeout: 30_000
        })
        .toEqual({
          [HOST_A]: [expect.stringMatching(/hostA_\d+_/)],
          [HOST_B]: [expect.stringMatching(/hostB_\d+_/)]
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

      await expect
        .poll(() => comfyPage.vueNodes.getBodyImageSources([HOST_A, HOST_B]))
        .toEqual({
          [HOST_A]: [expect.stringMatching(/hostA_\d+_/)],
          [HOST_B]: []
        })

      await comfyPage.runButton.click()
      await expect
        .poll(
          async () =>
            (await comfyPage.vueNodes.getBodyImageSources([HOST_B]))[HOST_B],
          { timeout: 30_000 }
        )
        .toEqual([expect.stringMatching(/hostB_\d+_/)])
    })
  }
)
