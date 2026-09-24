import { expect } from '@playwright/test'
import type { WebSocketRoute } from '@playwright/test'

import type {
  AgentMessage,
  AgentThreadListResponse
} from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { UserDataFullInfo } from '@/schemas/apiSchema'
import type {
  AgentTurnAccepted,
  CloudWorkflowEntry
} from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const OPEN_AGENT_LABEL = enMessages.agent.entryButton
const LEGACY_BINDING_KEY = 'Comfy.Agent.WorkflowTabBindings'
const THREAD_KEY = 'Comfy.Agent.ThreadId'
const DEFAULT_TAB_PATH = 'workflows/Unsaved Workflow.json'
const DEFAULT_TAB_NAME = 'Unsaved Workflow'
const THREAD_ID = '6f4b1e2a-7c3d-4e5f-8a9b-0c1d2e3f4a5b'
const TURN_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
const STALE_WORKFLOW_ID = '3d4d7f1e-3c8b-4a0a-9a3c-1d2e3f4a5b6c'
const EARLIER_REQUEST = 'Earlier request'
const STALE_WORKFLOW = {
  nodes: [
    {
      id: 1,
      type: 'MarkdownNote',
      pos: [200, 200] as [number, number],
      size: [300, 120] as [number, number],
      mode: 0,
      order: 0,
      flags: {},
      inputs: [],
      outputs: [],
      properties: {},
      widgets_values: ['Abandoned workflow content']
    }
  ],
  links: []
}
const STALE_WORKFLOW_CATALOG = {
  types: { MarkdownNote: { widget_order: ['text'] } }
}

// A browser tab closed without the SPA's own cleanup never runs
// agentWorkflowTabBindingStore's unbind(), so its legacy record still names
// the abandoned tab's workflow under the default path every unsaved tab
// reuses, and the thread pointer survives beside it. On the next boot the
// thread hydrates and names that workflow. The binding store must refuse to
// hand that workflow to the brand-new default-path tab (its document id is not
// the abandoned one), so the next turn is not posted as that workflow and the
// CRDT follower never pulls its real content onto the fresh canvas.
//
// See agentWorkflowTabBindingStore.test.ts and AgentPanelRoot.test.ts ("does
// not restore an abandoned tab binding onto a brand-new default-path tab") for
// narrower, backend-free coverage of the same chain.
test.describe(
  'Agent stale workflow tab binding',
  { tag: ['@cloud', '@agent'] },
  () => {
    test("a brand-new default-path tab does not inherit an abandoned tab's real content", async ({
      page,
      agentFlagEnabled
    }, testInfo) => {
      test.setTimeout(90_000)

      const staleWorkflowId = STALE_WORKFLOW_ID
      const host = new HostDoc(
        staleWorkflowId,
        STALE_WORKFLOW,
        STALE_WORKFLOW_CATALOG
      )

      // The previous tab's own in-app cleanup never ran (its browser tab was
      // simply closed), so the binding cache and the thread pointer survive
      // untouched into this brand-new page load.
      await page.addInitScript(
        ([bindingKey, threadKey, id, path, threadId]) => {
          localStorage.setItem(bindingKey, JSON.stringify({ [id]: path }))
          localStorage.setItem(threadKey, threadId)
        },
        [
          LEGACY_BINDING_KEY,
          THREAD_KEY,
          staleWorkflowId,
          DEFAULT_TAB_PATH,
          THREAD_ID
        ] as const
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

      const history: AgentMessage[] = [
        {
          id: 'user-1',
          thread_id: THREAD_ID,
          turn_id: TURN_ID,
          seq: 1,
          role: 'user',
          status: 'complete',
          workflow_id: staleWorkflowId,
          content: { text: EARLIER_REQUEST }
        }
      ]
      const threads: AgentThreadListResponse = {
        threads: [
          {
            id: THREAD_ID,
            title: 'Earlier chat',
            preview: EARLIER_REQUEST,
            workflow_id: staleWorkflowId,
            status: 'active',
            message_count: 1,
            created_at: '2026-09-11T10:00:00Z',
            updated_at: '2026-09-11T10:00:00Z',
            last_message_at: '2026-09-11T10:00:00Z'
          }
        ],
        pagination: { offset: 0, limit: 100, total: 1, has_more: false }
      }
      const posted: unknown[] = []
      await page.route('**/api/agent/threads', (route) =>
        route.fulfill(jsonRoute(threads))
      )
      await page.route('**/api/agent/threads/*/messages', (route) => {
        if (route.request().method() === 'GET')
          return route.fulfill(jsonRoute(history))
        posted.push(route.request().postDataJSON())
        // The thread's server-side pointer still names the abandoned workflow.
        const accepted: AgentTurnAccepted = {
          thread_id: THREAD_ID,
          message_id: TURN_ID,
          workflow_id: staleWorkflowId
        }
        return route.fulfill({ ...jsonRoute(accepted), status: 202 })
      })
      const cloudWorkflows: CloudWorkflowEntry[] = []
      await page.route('**/api/workflows**', (route) =>
        route.fulfill(
          jsonRoute({
            data: cloudWorkflows,
            pagination: {
              has_more: false,
              limit: 100,
              offset: 0,
              total: cloudWorkflows.length
            }
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

      // Re-targeting the fresh tab saves it as a new cloud workflow. These
      // routes go on after boot so they win over the boot mocks' userdata stub.
      const savedFiles: UserDataFullInfo[] = []
      await page.route('**/api/userdata?*', (route) => {
        const dir = new URL(route.request().url()).searchParams.get('dir')
        if (dir !== 'workflows') return route.fallback()
        return route.fulfill(
          jsonRoute(
            savedFiles.map((file) => ({
              ...file,
              path: file.path.slice('workflows/'.length)
            }))
          )
        )
      })
      await page.route('**/api/userdata/*', (route) => {
        const path = decodeURIComponent(
          new URL(route.request().url()).pathname.split('/userdata/')[1]
        )
        if (!path.startsWith('workflows/')) return route.fallback()
        if (route.request().method() !== 'POST')
          return route.fulfill({ status: 404 })
        cloudWorkflows.push({
          id: 'a81718a4-02ae-41e6-ae85-000000000001',
          name: path.slice('workflows/'.length, -'.json'.length)
        })
        const file: UserDataFullInfo = {
          path,
          modified: Date.now(),
          size: route.request().postDataBuffer()?.length ?? 1
        }
        savedFiles.push(file)
        return route.fulfill(jsonRoute(file))
      })

      const topbar = new Topbar(page)
      const tabs = topbar.workflowTabs.locator('.p-togglebutton')
      await expect(tabs).toHaveCount(1)
      await expect(page.getByTestId('node-title').first()).toBeVisible()
      const initialNodeTitles = await page
        .getByTestId('node-title')
        .allTextContents()

      // A brand-new page on the surviving thread: nobody has sent anything.
      await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
      const panel = page.locator('#agent-panel-root')
      await expect(panel).toBeVisible()
      await expect(panel.getByTestId('user-message-bubble')).toHaveText([
        EARLIER_REQUEST
      ])
      if (!socket) throw new Error('the app never opened /ws')

      // The user continues the thread in the fresh tab.
      const workflowPicker = panel.getByRole('button', {
        name: enMessages.agent.switchWorkflow
      })
      await workflowPicker.click()
      await page
        .getByRole('menuitemradio', { name: DEFAULT_TAB_NAME, exact: true })
        .click()
      await expect(workflowPicker).toHaveText(DEFAULT_TAB_NAME)
      await panel.getByRole('textbox').fill('continue here')
      await panel
        .getByRole('button', { name: enMessages.agent.send, exact: true })
        .click()
      await expect.poll(() => posted.length).toBe(1)
      expect(posted[0]).toMatchObject({
        workflow_id: 'a81718a4-02ae-41e6-ae85-000000000001'
      })
      await expect(
        page.getByText(enMessages.agent.targetNavigationUnavailable)
      ).toBeVisible()

      await testInfo.attach('stale-workflow-canvas', {
        body: await page.screenshot({
          path: testInfo.outputPath('stale-workflow-canvas.png')
        }),
        contentType: 'image/png'
      })

      await expect(tabs).toHaveCount(1)
      await expect(topbar.getActiveTab()).toContainText(DEFAULT_TAB_NAME)
      await expect(page.getByTestId('node-title')).toHaveText(initialNodeTitles)
    })
  }
)
