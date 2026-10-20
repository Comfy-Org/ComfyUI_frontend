import { expect, mergeTests } from '@playwright/test'

import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { webSocketFixture } from '@e2e/fixtures/ws'
import { agentReplayNodeDefs } from '@e2e/fixtures/data/agentReplayNodeDefs'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { agentTest, pushAgentEvent } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

test.describe(
  'Agent restart node refresh',
  { tag: ['@cloud', '@agent', '@canvas', '@node'] },
  () => {
    test.use({ connectWebSocketToServer: false, objectInfo: 'server' })

    test('refreshes node definitions and reloads the active workflow', async ({
      agentPanel,
      comfyPage,
      getAgentSocket
    }) => {
      test.setTimeout(60_000)
      const page = comfyPage.page

      await test.step('load workflow with a missing node', async () => {
        await comfyPage.workflow.loadWorkflow('agent/restart_node_refresh')
        await expect
          .poll(() =>
            page.evaluate(() => {
              const node = window.app!.graph.nodes.find(
                (candidate) => String(candidate.id) === '1'
              )
              return {
                type: node?.type,
                hasErrors: node?.has_errors === true,
                hasStepsWidget: node?.widgets?.some(
                  (widget) => widget.name === 'steps'
                )
              }
            })
          )
          .toEqual({
            type: 'BrowserProofNode',
            hasErrors: true,
            hasStepsWidget: false
          })
      })

      await page.route('**/object_info', async (route) => {
        await route.fulfill(
          jsonRoute({
            ...agentReplayNodeDefs,
            BrowserProofNode: {
              ...agentReplayNodeDefs.KSampler,
              name: 'BrowserProofNode',
              display_name: 'Browser Proof Node'
            }
          })
        )
      })

      await test.step('deliver the successful restart event', async () => {
        await agentPanel.open()
        await agentPanel.selectWorkflow('restart_node_refresh')
        const ws = await getAgentSocket()
        const refreshedDefinitions = page.waitForRequest('**/object_info', {
          timeout: 5_000
        })
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
        await refreshedDefinitions
      })

      await test.step('verify the active workflow was reconstructed', async () => {
        await expect
          .poll(() =>
            page.evaluate(() => {
              const node = window.app!.graph.nodes.find(
                (candidate) => String(candidate.id) === '1'
              )
              return {
                type: node?.type,
                hasErrors: node?.has_errors === true,
                hasStepsWidget: node?.widgets?.some(
                  (widget) => widget.name === 'steps'
                )
              }
            })
          )
          .toEqual({
            type: 'BrowserProofNode',
            hasErrors: false,
            hasStepsWidget: true
          })
      })
    })
  }
)
