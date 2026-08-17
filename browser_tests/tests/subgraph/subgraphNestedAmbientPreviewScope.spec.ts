import { mergeTests } from '@playwright/test'

import {
  comfyPageFixture,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const OUTER_HOST_ID = '1'
const OUTER_HOST_TITLE = 'Outer Subgraph'
// `Middle Subgraph` (node 2, interior to the outer host) wraps the live
// sampler one level further down. Neither host has a `previewExposures`
// entry, so this fixture only passes if the ambient rollup — not the
// exposure/promotion system — is what surfaces the preview.
const MIDDLE_HOST_TITLE = 'Middle Subgraph'
const SAMPLER_EXECUTION_ID = `${OUTER_HOST_ID}:2:3`

test.describe(
  'Subgraph ambient preview nesting scope (regression)',
  { tag: ['@vue-nodes', '@subgraph'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-nested-with-live-sampler'
      )
      await comfyPage.vueNodes.waitForNodes(1)
    })

    test('an ambient preview two levels deep bubbles to its immediate host only, not the outermost host', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)
      const outerHost = comfyPage.vueNodes.getNodeByTitle(OUTER_HOST_TITLE)
      const outerPreviewImages = outerHost.locator('img[src^="blob:"]')

      const jobId = await exec.run()
      await comfyPage.nextFrame()
      exec.executionStart(jobId)
      exec.latentPreview(jobId, SAMPLER_EXECUTION_ID)

      await test.step('the outermost host shows no preview: ambient rollup does not recurse past its immediate interior nodes', async () => {
        // `useAmbientSubgraphPreviews` explicitly skips interior nodes that
        // are themselves `SubgraphNode`s, so `Middle Subgraph` never
        // contributes its own interior sampler's preview to `Outer Subgraph`.
        await comfyPage.nextFrame()
        await expect(outerPreviewImages).toHaveCount(0)
      })

      await test.step('entering the outer subgraph shows the preview on the immediate (middle) host', async () => {
        await comfyPage.vueNodes.enterSubgraph(OUTER_HOST_ID)

        const middleHost = comfyPage.vueNodes.getNodeByTitle(MIDDLE_HOST_TITLE)
        await expect(middleHost.locator('img[src^="blob:"]')).toHaveCount(1)
      })
    })
  }
)
