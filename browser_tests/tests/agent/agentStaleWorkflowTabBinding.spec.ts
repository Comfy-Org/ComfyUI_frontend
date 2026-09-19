import { expect } from '@playwright/test'
import type { WebSocketRoute } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { loadAgentConversation } from '@e2e/fixtures/data/agent/agentConversation'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent
const STALE_BINDING_KEY = 'Comfy.Agent.WorkflowTabBindings'
const DEFAULT_TAB_PATH = 'workflows/Unsaved Workflow.json'

// PM-1255 / PM-986: a browser tab closed without the SPA's own cleanup never
// runs agentWorkflowTabBindingStore's unbind(), so `Comfy.Agent.WorkflowTabBindings`
// - plain, unscoped localStorage with no TTL and no per-page-load nonce -
// still names the abandoned tab's workflow under the shared default path
// every new/unsaved tab uses. A brand-new tab that opens at that same
// default path silently inherits the binding, and the CRDT follower
// subscribes to (and renders) that workflow's real content before the user
// has asked for anything.
//
// This is a pinned repro, not a fix, so it seeds the exact abandoned-tab
// condition and asserts the correct behavior (no inherited content), which
// currently fails. See agentWorkflowTabBindingStore.test.ts and
// AgentPanelRoot.test.ts ("does not resubscribe an abandoned tab binding
// onto a brand-new default-path tab") for narrower, backend-free
// reproductions of the same root cause.
test.describe(
  'Agent stale workflow tab binding (PM-1255/PM-986)',
  { tag: ['@cloud', '@agent'] },
  () => {
    test("a brand-new default-path tab does not inherit an abandoned tab's real content", async ({
      page,
      agentFlagEnabled
    }, testInfo) => {
      // Pinned repro (PM-1255/PM-986): the whole test is expected-to-fail
      // until the stale-binding leak is fixed, so this must run before any
      // assertion can throw.
      test.fail()
      test.setTimeout(60_000)

      const { workflow } = loadAgentConversation('agent-workflow-editing-05')
      const staleWorkflowId = workflow.id
      const host = new HostDoc(staleWorkflowId, workflow.seed, workflow.catalog)

      // The previous tab's own in-app cleanup never ran (its browser tab was
      // simply closed), so the binding cache survives untouched into this
      // brand-new page load.
      await page.addInitScript(
        ([key, id, path]) => {
          localStorage.setItem(key, JSON.stringify({ [id]: path }))
        },
        [STALE_BINDING_KEY, staleWorkflowId, DEFAULT_TAB_PATH] as const
      )

      let socket: WebSocketRoute | undefined
      await page.routeWebSocket(/\/ws/, (ws) => {
        socket = ws
        // Answers a doc_subscribe for the abandoned workflow with its real
        // seeded content, the way the production doc host would.
        ws.onMessage((raw) => {
          const frame: unknown = JSON.parse(raw.toString())
          if (typeof frame !== 'object' || frame === null) return
          const { type, data } = frame as { type?: unknown; data?: unknown }
          if (
            type !== 'doc_subscribe' ||
            typeof data !== 'object' ||
            data === null
          )
            return
          const { workflow_id, state_vector_b64 } = data as {
            workflow_id?: unknown
            state_vector_b64?: unknown
          }
          if (
            workflow_id !== staleWorkflowId ||
            typeof state_vector_b64 !== 'string'
          )
            return
          ws.send(JSON.stringify(host.subscribed()))
          ws.send(JSON.stringify(host.catchUp(state_vector_b64)))
        })
        // The follower only re-drives a pending subscribe on a status frame,
        // which every real connect sends.
        ws.send(
          JSON.stringify({
            type: 'status',
            data: { status: { exec_info: { queue_remaining: 0 } } }
          })
        )
      })
      await page.route('**/api/agent/threads', (route) =>
        route.fulfill(jsonRoute({ threads: [] }))
      )
      await page.route('**/api/workflows**', (route) =>
        route.fulfill(
          jsonRoute({
            data: [],
            pagination: { has_more: false, limit: 100, offset: 0, total: 0 }
          })
        )
      )

      await bootAgentApp(page, agentFlagEnabled, {
        // Only the Vue node renderer projects follower edits onto the canvas.
        settings: {
          'Comfy.VueNodes.Enabled': true,
          'Comfy.Graph.CanvasInfo': false
        },
        // The replayed nodes materialize from registered node types.
        objectInfo: 'server'
      })

      // The leak fires on the WS `status` frame during boot, before any
      // explicit tab-switch push - the canvas is already poisoned here.

      // A brand-new chat: nobody has selected a workflow or sent a message.
      await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
      const panel = page.locator('#agent-panel-root')
      await expect(panel).toBeVisible()

      if (!socket) throw new Error('the app never opened /ws')
      // The same server push a real tab switch sends - here naming the
      // abandoned tab's workflow, unprompted, on a chat nobody has touched.
      socket.send(
        JSON.stringify({
          type: 'agent_active_tab',
          data: { workflow_id: staleWorkflowId, name: workflow.name }
        })
      )

      // Give the (buggy) follower a chance to subscribe and materialize the
      // abandoned workflow's nodes before judging the canvas. Once fixed,
      // this never resolves and the catch lets the final assertion run.
      await page
        .getByTestId('node-title')
        .first()
        .waitFor({ state: 'visible', timeout: 5_000 })
        .catch(() => undefined)

      await testInfo.attach('stale-workflow-canvas', {
        body: await page.screenshot({
          path: testInfo.outputPath('stale-workflow-canvas.png')
        }),
        contentType: 'image/png'
      })

      // Pinned repro: production currently subscribes the brand-new tab to
      // the abandoned workflow's document and renders its real nodes
      // (LoadImage, VAEEncode, KSampler, VAEDecode, SaveImage) here.
      await expect(page.getByTestId('node-title')).toHaveCount(0)
    })
  }
)
