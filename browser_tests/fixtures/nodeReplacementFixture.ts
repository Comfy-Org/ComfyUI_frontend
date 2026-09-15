import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { mockNodeReplacementsSingle } from '@e2e/fixtures/data/nodeReplacements'
import { mockNodeReplacement } from '@e2e/fixtures/helpers/NodeReplacementHelper'
import type { NodeReplacementResponse } from '@/platform/nodeReplacement/types'

export const nodeReplacementFixture = comfyPageFixture.extend<{
  nodeReplacements: NodeReplacementResponse
  nodeReplacementReady: () => Promise<void>
}>({
  nodeReplacements: [mockNodeReplacementsSingle, { option: true }],
  nodeReplacementReady: [
    async ({ page, nodeReplacements }, use) => {
      await mockNodeReplacement(page, nodeReplacements)
      const responseResult = Promise.allSettled([
        page.waitForResponse(
          (response) =>
            response.url().includes('/api/node_replacements') && response.ok(),
          { timeout: 10000 }
        )
      ])
      await use(async () => {
        const [result] = await responseResult
        if (result.status === 'rejected') throw result.reason
      })
    },
    { auto: true }
  ],
  comfyPage: async ({ nodeReplacementReady, comfyPage }, use) => {
    await nodeReplacementReady()
    await use(comfyPage)
  }
})
