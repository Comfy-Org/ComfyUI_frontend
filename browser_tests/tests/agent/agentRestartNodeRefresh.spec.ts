import { expect, mergeTests } from '@playwright/test'

import { toNodeId } from '@/types/nodeId'
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { webSocketFixture } from '@e2e/fixtures/ws'
import { agentReplayNodeDefs } from '@e2e/fixtures/data/agentReplayNodeDefs'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { agentTest, pushAgentEvent } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)
const browserProofNodeId = toNodeId(1)

test.describe(
  'Agent restart node refresh',
  { tag: ['@cloud', '@agent', '@canvas', '@node'] },
  () => {
    test.use({ connectWebSocketToServer: false, objectInfo: 'server' })

    let restarted = false

    test.beforeEach(async ({ comfyPage }) => {
      const page = comfyPage.page
      restarted = false
      await page.route('**/object_info', async (route) => {
        await route.fulfill(
          jsonRoute(
            restarted
              ? {
                  ...agentReplayNodeDefs,
                  BrowserProofNode: {
                    ...agentReplayNodeDefs.KSampler,
                    name: 'BrowserProofNode',
                    display_name: 'Browser Proof Node'
                  }
                }
              : agentReplayNodeDefs
          )
        )
      })

      await comfyPage.workflow.loadWorkflow('agent/restart_node_refresh')
      await expect
        .poll(() =>
          page.evaluate((nodeId) => {
            const node = window.app!.graph.getNodeById(nodeId)
            return {
              type: node?.type,
              hasErrors: node?.has_errors === true,
              hasStepsWidget: node?.widgets?.some(
                (widget) => widget.name === 'steps'
              )
            }
          }, browserProofNodeId)
        )
        .toEqual({
          type: 'BrowserProofNode',
          hasErrors: true,
          hasStepsWidget: false
        })
    })

    // The restart report and ComfyUI's reconnect travel on different sockets,
    // so the page must recover in either order.
    for (const reportFirst of [true, false]) {
      test(`refreshes node definitions and reloads the active workflow when ${
        reportFirst ? 'the restart report' : 'the ComfyUI reconnect'
      } arrives first`, async ({
        agentPanel,
        comfyPage,
        getAgentSocket,
        getWebSocket,
        nextWebSocket
      }) => {
        test.setTimeout(60_000)
        const page = comfyPage.page

        await agentPanel.open()
        await agentPanel.selectWorkflow('restart_node_refresh')

        const deliverRestartReport = () =>
          test.step('deliver the agent restart report', async () => {
            const ws = await getAgentSocket()
            const restart: AgentWsEvent = {
              type: 'agent_tool_call',
              data: {
                tool_call_id: 'call-restart-browser-proof',
                tool_name: 'restart_comfyui',
                status: 'success',
                message_id: 'message-restart-browser-proof',
                thread_id: 'thread-restart-browser-proof'
              }
            }
            pushAgentEvent(ws, restart)
          })

        const restartComfy = () =>
          test.step('restart ComfyUI with the new node loaded', async () => {
            const comfySocket = await getWebSocket()
            const pageReconnected = await page.evaluateHandle(() => ({
              done: new Promise<void>((resolve) =>
                window.app!.api.addEventListener(
                  'reconnected',
                  () => resolve(),
                  { once: true }
                )
              )
            }))
            const reconnected = nextWebSocket()
            restarted = true
            await comfySocket.close()
            await reconnected
            await pageReconnected.evaluate(({ done }) => done)
          })

        if (reportFirst) {
          await deliverRestartReport()
          await restartComfy()
        } else {
          await restartComfy()
          await deliverRestartReport()
        }

        await test.step('verify the active workflow was reconstructed', async () => {
          await expect
            .poll(() =>
              page.evaluate((nodeId) => {
                const node = window.app!.graph.getNodeById(nodeId)
                return {
                  type: node?.type,
                  hasErrors: node?.has_errors === true,
                  hasStepsWidget: node?.widgets?.some(
                    (widget) => widget.name === 'steps'
                  ),
                  seed: node?.widgets?.find((widget) => widget.name === 'seed')
                    ?.value
                }
              }, browserProofNodeId)
            )
            .toEqual({
              type: 'BrowserProofNode',
              hasErrors: false,
              hasStepsWidget: true,
              seed: 156680208700286
            })
        })
      })
    }
  }
)
