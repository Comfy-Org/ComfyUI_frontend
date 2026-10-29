import { expect } from '@playwright/test'
import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'
import type { AgentPostMessageRequest } from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'

import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  agentTest as test,
  bootAgentApp,
  mockAgentTurnApi
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import {
  AGENT_NODE_IDS,
  emptySeed
} from '@e2e/fixtures/data/agent/agentRemoteApply'
import { agentReplayNodeDefs } from '@e2e/fixtures/data/agentReplayNodeDefs'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { mockSavedWorkflowPersistence } from '@e2e/fixtures/utils/savedWorkflowPersistence'

/**
 * PM-2392: the agent process goes down, the user changes a widget by hand
 * and saves, and the reconnect projects the agent document's older value
 * back over the edit — in the live widget, in the next save, and in what the
 * next agent turn reads.
 *
 * The report is about two Load Image nodes. The register this spec drives is
 * a `CLIPTextEncode.text` widget instead, because the defect is a property of
 * a last-writer-wins widget register and not of any node class, and because
 * the Load Image picker only offers a filename the backend can actually serve
 * — mocking one through the missing-media path would test the picker, not the
 * reconnect. Everything else is the reported sequence: outage, hand edit,
 * save, reconnect, reload, next turn.
 */

const WORKFLOW_ID = '5a41f0b2-9c6e-4a71-8f03-2b6de4c10001'
const THREAD_ID = '5a41f0b2-9c6e-4a71-8f03-2b6de4c10002'
const FIRST_MESSAGE_ID = '5a41f0b2-9c6e-4a71-8f03-2b6de4c10003'
const SECOND_MESSAGE_ID = '5a41f0b2-9c6e-4a71-8f03-2b6de4c10004'
const [FIRST_NODE_ID, SECOND_NODE_ID] = AGENT_NODE_IDS

/** What the agent put in the document before the outage. */
const AGENT_PROMPTS = ['agent prompt one', 'agent prompt two'] as const
/** What the user types by hand while the agent process is down. */
const HUMAN_PROMPTS = ['human prompt one', 'human prompt two'] as const

const CLASS_TYPE = 'CLIPTextEncode'
const SAVED_NAME = 'pm-2392-offline-edit'

/** The follower only projects widgets for a class the pinned catalog names. */
const catalog: WidgetCatalog = {
  types: { [CLASS_TYPE]: { widget_order: ['text'] } }
}

function addPromptNode(nodeId: number, index: number): RecordedGraphOperation {
  const pos = [120 + index * 320, 140]
  return {
    op: 'add_node',
    pos,
    node: {
      id: nodeId,
      pos,
      mode: 0,
      size: [300, 200],
      type: CLASS_TYPE,
      flags: {},
      order: index,
      inputs: [],
      outputs: [],
      properties: {},
      widgets_values: [AGENT_PROMPTS[index]]
    },
    node_id: nodeId,
    class_type: CLASS_TYPE
  }
}

function done(messageId: string): AgentWsEvent {
  return {
    type: 'agent_message_done',
    data: { thread_id: THREAD_ID, message_id: messageId, usage: null }
  }
}

function parsePost(body: string | null): AgentPostMessageRequest {
  const parsed: unknown = JSON.parse(body ?? '{}')
  return zAgentPostMessageRequest.parse(parsed)
}

/**
 * How long the outage has to last, counted in refused reconnects rather than
 * wall clock, so this never becomes a sleep that is "probably long enough".
 *
 * The op sender's transport retry budget is five retries 500 ms apart, i.e.
 * 2.5 s. Below that the batch is still in its ladder and any reconnect
 * carries it with no fix needed; above it the pre-fix sender settled the
 * batch `undeliverable`, which is both the lost edit and the lifted
 * `LocalWidgetWrites` hold that lets the reconnect frame put the agent's
 * older value back on the canvas. The page's own reconnect ladder backs off
 * 1 s, 2 s, 4 s, 8 s with 0.5-1.0 jitter, so four refusals cannot have taken
 * less than 7.5 s — comfortably past the budget, and observed rather than
 * assumed.
 */
const REFUSALS_OUTLASTING_RETRY_BUDGET = 4

test.describe(
  'Human edits made while the agent process is down',
  { tag: ['@cloud', '@agent', '@vue-nodes', '@widget'] },
  () => {
    test(
      'survive the reconnect, the save, a reload and the next agent turn',
      {
        annotation: [
          {
            type: 'issue',
            description:
              'https://linear.app/comfyorg/issue/PM-2392/agent-reconnect-overwrites-load-image-edits-saved-during-the-outage'
          }
        ]
      },
      async ({ page, request }) => {
        test.setTimeout(180_000)
        const comfyPage = new ComfyPage(page, request)
        const host = new HostDoc(WORKFLOW_ID, emptySeed, catalog)
        const hostSocket = new AgentFollowerHostSocket(
          page,
          WORKFLOW_ID,
          host,
          'apply'
        )
        const panel = new AgentPanel(page)
        const topbar = new Topbar(page)
        const posts: AgentPostMessageRequest[] = []
        const docPrompt = (nodeId: number): unknown => {
          const widgets = host.graph().nodes[String(nodeId)]?.widgets as
            | Record<string, unknown>
            | undefined
          return widgets?.text
        }

        await page.route('**/api/object_info', (route) =>
          route.fulfill(jsonRoute(agentReplayNodeDefs))
        )
        await hostSocket.install()
        await mockAgentTurnApi(page, {
          thread_id: THREAD_ID,
          message_id: FIRST_MESSAGE_ID,
          workflow_id: WORKFLOW_ID
        })
        await page.route('**/api/agent/threads/*/messages', (route) => {
          if (route.request().method() !== 'POST') return route.fallback()
          posts.push(parsePost(route.request().postData()))
          return route.fulfill(
            jsonRoute({
              thread_id: THREAD_ID,
              message_id:
                posts.length === 1 ? FIRST_MESSAGE_ID : SECOND_MESSAGE_ID,
              workflow_id: WORKFLOW_ID
            })
          )
        })
        await bootAgentApp(page, true, {
          objectInfo: 'server',
          settings: { 'Comfy.Graph.CanvasInfo': false }
        })
        const saved = await mockSavedWorkflowPersistence(page, WORKFLOW_ID)

        const promptField = (index: number) =>
          comfyPage.vueNodes
            .getNodeLocator(String([FIRST_NODE_ID, SECOND_NODE_ID][index]))
            .getByLabel('text', { exact: true })

        await test.step('the agent builds two prompt nodes', async () => {
          await panel.open()
          await panel.selectWorkflow()
          await panel.sendMessage('Add two prompt nodes.')
          await hostSocket.waitForSubscribe()

          hostSocket.send(
            host.apply([
              addPromptNode(FIRST_NODE_ID, 0),
              addPromptNode(SECOND_NODE_ID, 1)
            ])
          )
          hostSocket.send(done(FIRST_MESSAGE_ID))

          for (const [index, value] of AGENT_PROMPTS.entries())
            await expect(promptField(index)).toHaveValue(value)
        })

        const subscribesBeforeOutage = hostSocket.subscribeCount()

        await test.step('the agent process goes down and the user retypes both prompts', async () => {
          await hostSocket.beginAgentOutage()

          for (const [index, value] of HUMAN_PROMPTS.entries()) {
            await promptField(index).fill(value)
            await promptField(index).press('Tab')
            await expect(promptField(index)).toHaveValue(value)
          }

          // The outage has to outlast the sender's retry budget: that is the
          // window PM-2392 lives in, and a shorter one proves nothing. Each
          // refusal is also proof the page's reconnect ladder is still alive,
          // so a later "no reconnect" cannot be a dead ladder instead.
          await expect
            .poll(() => hostSocket.refusedConnectionCount(), {
              timeout: 90_000,
              message: 'the page keeps trying while the agent is down'
            })
            .toBeGreaterThanOrEqual(REFUSALS_OUTLASTING_RETRY_BUDGET)
          for (const [index, value] of HUMAN_PROMPTS.entries())
            await expect(promptField(index)).toHaveValue(value)
        })

        await test.step('the agent comes back and catches the canvas up', async () => {
          // What QA saw on Windows was `doc_subscribe` plus a FULL
          // `doc_update` at seq 1, because the agent process that came back
          // had rebuilt its document rather than resumed one. A delta
          // catch-up carries nothing here and would hide the overwrite, so
          // the restarted host answers with its whole state.
          hostSocket.answerSubscribesWith(() => host.initialSync())
          hostSocket.endAgentOutage()
          await expect
            .poll(() => hostSocket.subscribeCount(), { timeout: 90_000 })
            .toBeGreaterThan(subscribesBeforeOutage)

          // The user-visible symptom first: the document's older value must
          // not land back on the register the user just changed.
          for (const [index, value] of HUMAN_PROMPTS.entries())
            await expect(promptField(index), {
              message: 'the reconnect must not overwrite the offline edit'
            }).toHaveValue(value, { timeout: 60_000 })

          // And the edit has to reach the document, not merely stay on
          // screen: a canvas that kept the value while the document kept the
          // old one would lose it on the next projection anyway.
          await expect
            .poll(() => docPrompt(FIRST_NODE_ID), {
              timeout: 60_000,
              message: 'the held edit reaches the document on reconnect'
            })
            .toBe(HUMAN_PROMPTS[0])
          await expect
            .poll(() => docPrompt(SECOND_NODE_ID), { timeout: 60_000 })
            .toBe(HUMAN_PROMPTS[1])
        })

        await test.step('the save after the reconnect still holds them', async () => {
          await topbar.saveWorkflowAs(SAVED_NAME)
          await expect
            .poll(() => saved.savedContent())
            .toContain(HUMAN_PROMPTS[0])
          const content = saved.savedContent() ?? ''
          for (const value of HUMAN_PROMPTS) expect(content).toContain(value)
          for (const value of AGENT_PROMPTS)
            expect(content).not.toContain(value)
        })

        await test.step('a reload reopens them from the server', async () => {
          const restored = page.waitForResponse(
            (response) =>
              response.request().method() === 'GET' &&
              decodeURIComponent(new URL(response.url()).pathname) ===
                `/api/userdata/workflows/${SAVED_NAME}.json`,
            { timeout: 90_000 }
          )
          await page.reload({ waitUntil: 'domcontentloaded' })
          await panel.open()
          await panel.selectWorkflow(SAVED_NAME)
          expect((await restored).ok()).toBe(true)
          for (const [index, value] of HUMAN_PROMPTS.entries())
            await expect(promptField(index)).toHaveValue(value, {
              timeout: 60_000
            })
        })

        await test.step('the next agent turn reads them too', async () => {
          const postsBefore = posts.length
          await panel.sendMessage('Which prompts am I using?')
          await expect.poll(() => posts.length).toBe(postsBefore + 1)
          const draft = JSON.stringify(posts[postsBefore].draft ?? {})
          for (const value of HUMAN_PROMPTS) expect(draft).toContain(value)
          for (const value of AGENT_PROMPTS) expect(draft).not.toContain(value)
        })
      }
    )
  }
)
