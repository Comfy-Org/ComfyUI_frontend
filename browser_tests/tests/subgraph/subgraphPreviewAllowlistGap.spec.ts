import { mergeTests } from '@playwright/test'

import {
  comfyPageFixture,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const SUBGRAPH_NODE_ID = '1'
const INTERIOR_SAMPLER_NODE_ID = '1'
// Composite execution id for the interior SamplerCustomAdvanced node (local
// id 1), nested one level inside the outer SubgraphNode (id 1) — matches the
// `host:local` format the backend uses for nodes inside a subgraph.
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

    // Regression test for the gap introduced by PR #12197 ("Subgraph Link
    // Only Promotion" / ADR 0009). `autoExposeKnownPreviewNodes` only
    // auto-exposes a preview for interior node types hardcoded in
    // `CANVAS_IMAGE_PREVIEW_NODE_TYPES` (KSampler, KSamplerAdvanced,
    // PreviewImage, SaveImage, GLSLShader). SamplerCustomAdvanced is not on
    // that list, so it falls back to a one-shot `requestAnimationFrame`
    // check that runs immediately — long before the sampler has produced any
    // output — and is never retried. When the real preview image later
    // arrives mid-execution over the websocket, it is silently dropped: the
    // outer SubgraphNode never shows a preview.
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

        // Mid-execution sampler preview — arrives well after the subgraph
        // was created (and its one-shot auto-expose pass already ran), and
        // well before any `executed` output message, exactly as it does for
        // a real, in-progress sampler.
        exec.latentPreview(jobId, SAMPLER_EXECUTION_ID)

        await expect(previewImage).toBeVisible()
      })
    })
  }
)
