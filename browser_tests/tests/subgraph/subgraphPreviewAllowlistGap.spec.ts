import { mergeTests } from '@playwright/test'

import {
  comfyPageFixture,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const SUBGRAPH_NODE_ID = '1'
const INTERIOR_SAMPLER_NODE_ID = '2'
const SAMPLER_EXECUTION_ID = `${SUBGRAPH_NODE_ID}:${INTERIOR_SAMPLER_NODE_ID}`

test.describe(
  'Subgraph preview promotion allowlist gap (regression)',
  { tag: ['@vue-nodes', '@subgraph'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(
        'nodes/sampler_custom_advanced_in_subgraph'
      )
      await comfyPage.vueNodes.waitForNodes(1)
    })

    test('promotes a mid-execution preview from a non-allowlisted interior node onto the outer SubgraphNode', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)
      const subgraphNode = comfyPage.vueNodes.getNodeLocator(SUBGRAPH_NODE_ID)
      const previewImage = subgraphNode.locator('img[src^="blob:"]')

      await test.step('no preview is present before execution', async () => {
        await expect(previewImage).toHaveCount(0)
      })

      await test.step('a mid-execution preview promotes onto the outer SubgraphNode', async () => {
        const jobId = await exec.run()
        await comfyPage.nextFrame()
        exec.executionStart(jobId)
        exec.latentPreview(jobId, SAMPLER_EXECUTION_ID)

        await expect(previewImage).toBeVisible()
      })
    })
  }
)
