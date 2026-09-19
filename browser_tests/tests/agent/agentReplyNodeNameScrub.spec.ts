import type { WebSocketRoute } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'

import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

// PM-1323: the cloud agent's reply-scrubbing step (services/agent/internal/loop/
// scrub.go, ruleNodeClasses) used to swap a known node CLASS NAME for the literal
// word "node" with no awareness of the surrounding text, garbling the reply
// before it ever reached the browser. The Go-side regression
// (TestScrubNodeClassCompoundingBugPM1323 in Comfy-Org/cloud) proves the fix at
// the scrub function itself; this spec proves the CONSEQUENCE side — that the
// sane text a fixed backend now sends over agent_message_delta/agent_message_done
// reaches and renders in the real chat panel verbatim, because the panel does no
// scrubbing of its own and simply renders whatever the mocked API delivers.
const TURN_ID = '9c9c6c33-3f0e-4d2e-8e9d-5f2b5b7a3f01'
const THREAD_ID = 'b6e9d9e1-9f3a-4a7b-9a7f-2d0f1a6c3e02'

const cases: { name: string; text: string }[] = [
  {
    name: 'class name immediately followed by the word "node"',
    text: 'the node is on the canvas'
  },
  {
    name: 'sole class-name identifier next to a bare id citation',
    text: 'KSampler (#1364808305178364)'
  },
  {
    name: 'class name cited in parens right after its display name',
    text: 'Load Checkpoint'
  }
]

const test = mergeTests(agentTest, webSocketFixture)

function pushEvent(ws: WebSocketRoute, event: AgentWsEvent): void {
  ws.send(JSON.stringify(event))
}

test.describe(
  'Agent chat panel renders the fixed PM-1323 scrub output verbatim',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.use({ connectWebSocketToServer: false })

    for (const { name, text } of cases) {
      test(`reply text reaching the panel is sane: ${name}`, async ({
        agentPanel,
        getWebSocket
      }) => {
        test.setTimeout(30_000)

        await agentPanel.open()
        await agentPanel.selectWorkflow()
        const panel = agentPanel.root

        const composer = panel.getByRole('textbox', {
          name: /^Describe ideas/
        })
        const sendButton = panel.getByRole('button', { name: 'Send' })
        await composer.fill('what does this graph do')

        const ws = await getWebSocket()
        await sendButton.click()

        // This is the scrubbed text the fixed cloud agent sends (see
        // scrubNodeClasses in Comfy-Org/cloud's scrub.go): the server, not the
        // frontend, is responsible for not garbling it, and the panel here just
        // renders whatever the mocked API delivers.
        pushEvent(ws, {
          type: 'agent_message_delta',
          data: { delta: text, message_id: TURN_ID, thread_id: THREAD_ID }
        })
        pushEvent(ws, {
          type: 'agent_message_done',
          data: {
            message_id: TURN_ID,
            thread_id: THREAD_ID,
            usage: {
              input_tokens: 1,
              output_tokens: 1,
              total_tokens: 2,
              cache_read_input_tokens: 0,
              cache_creation_input_tokens: 0
            }
          }
        })

        await expect(panel.getByText(text, { exact: true })).toBeVisible()
      })
    }
  }
)
