import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { webSocketFixture } from '@e2e/fixtures/ws'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

const test = mergeTests(comfyPageFixture, webSocketFixture).extend<{
  restartedServer: { installed: boolean }
}>({
  restartedServer: async ({ page }, use) => {
    const server = { installed: false }
    await page.route('**/object_info', async (route) => {
      const response = await route.fetch()
      const defs: Record<string, ComfyNodeDef> = await response.json()
      if (server.installed) {
        defs.BrowserProofNode = {
          ...defs.KSampler,
          name: 'BrowserProofNode',
          display_name: 'Browser Proof Node'
        }
      }
      await route.fulfill({ response, json: defs })
    })
    await use(server)
  }
})

test.describe(
  'Node definitions after a ComfyUI restart',
  { tag: ['@canvas', '@node'] },
  () => {
    test('loads a node the restarted server now serves into the open workflow', async ({
      comfyPage,
      getWebSocket,
      nextWebSocket,
      restartedServer
    }) => {
      const page = comfyPage.page
      const proofNode = () =>
        page.evaluate((nodeId) => {
          const node = window.app!.graph.getNodeById(nodeId)
          return {
            type: node?.type,
            hasErrors: node?.has_errors === true,
            hasStepsWidget:
              node?.widgets?.some((widget) => widget.name === 'steps') === true,
            seed: node?.widgets?.find((widget) => widget.name === 'seed')?.value
          }
        }, toNodeId(1))

      await comfyPage.workflow.loadWorkflow('agent/restart_node_refresh')
      await expect.poll(proofNode).toEqual({
        type: 'BrowserProofNode',
        hasErrors: true,
        hasStepsWidget: false,
        seed: undefined
      })

      await test.step('restart ComfyUI with the node pack installed', async () => {
        const socket = await getWebSocket()
        const reconnected = nextWebSocket()
        restartedServer.installed = true
        await socket.close()
        await reconnected
      })

      await expect.poll(proofNode).toEqual({
        type: 'BrowserProofNode',
        hasErrors: false,
        hasStepsWidget: true,
        seed: 156680208700286
      })
    })
  }
)
