import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { webSocketFixture } from '@e2e/fixtures/ws'
import { toNodeId } from '@/types/nodeId'

const test = mergeTests(comfyPageFixture, webSocketFixture)
const proofNodeId = toNodeId(1)

/**
 * A ComfyUI restart the agent panel never saw (panel closed, `comfy launch`,
 * a Desktop server restart) must still pick up the node pack it installed.
 */
test.describe(
  'Node definitions after a ComfyUI restart',
  { tag: ['@canvas', '@node'] },
  () => {
    test('loads a node the restarted server now serves into the open workflow', async ({
      comfyPage,
      getWebSocket,
      nextWebSocket
    }) => {
      const page = comfyPage.page
      let restarted = false
      let objectInfoReads = 0
      await page.route('**/object_info', async (route) => {
        const response = await route.fetch()
        const defs = await response.json()
        if (restarted) {
          objectInfoReads += 1
          defs.BrowserProofNode = {
            ...defs.KSampler,
            name: 'BrowserProofNode',
            display_name: 'Browser Proof Node'
          }
        }
        await route.fulfill({ response, json: defs })
      })

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
        }, proofNodeId)

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
        restarted = true
        await socket.close()
        await reconnected
      })

      await expect.poll(proofNode).toEqual({
        type: 'BrowserProofNode',
        hasErrors: false,
        hasStepsWidget: true,
        seed: 156680208700286
      })
      expect(objectInfoReads).toBeGreaterThan(0)
    })
  }
)
