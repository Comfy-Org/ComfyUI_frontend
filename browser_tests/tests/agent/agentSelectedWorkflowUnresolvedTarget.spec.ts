import { expect } from '@playwright/test'
import type { Route } from '@playwright/test'

import type {
  AgentPostMessageRequest,
  AgentThreadListResponse,
  WorkflowListResponse
} from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'
import type { AgentTurnAccepted } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import type { WorkspaceStore } from '@e2e/types/globals'

// PM-1847: "agent says it can't see my selected workflow with only one tab open
// and gives a generic answer", reported twice - 1.54.15 on Linux x86_64 ("every
// time") and 1.54.16 on Android ("sometimes"). The second report's own session
// field names a thread where detection worked; the failure is in that
// reporter's previous thread, which ran three turns with no client-side
// workflow binding at all and applied zero graph mutations before they
// hand-picked a workflow from the chip. Diagnosis:
// in-app-agent-program reports/jobs/op350-pm1847-workflowdetect.md.
//
// The mechanism is a turn posted with NEITHER `workflow_id` NOR
// `current_tab_unbound`. Per `current_tab_unbound`'s own contract that is the
// one combination the server reads as "no tab is selected" rather than
// "selected-but-unbound": it falls back to the thread's remembered workflow and
// presents the turn to the model as having no workflow selected. The composer
// meanwhile still names the tab, which is why the report reads "I have only one
// tab open and clearly selected the workflow inside the agent".
//
// This is the reachable path that needs no tab churn: a saved tab the user
// never picked in the chip (a fresh chat follows the visible workflow -
// AGENT-TARGET-0037), whose cloud id does not resolve. `cloudIdFor` drops a
// name that appears more than once in the cloud listing, so two cloud
// workflows sharing the tab's name is enough, and no binding exists to fall
// back to. `targetWorkflowTurnContext` then answers "a tab is selected" when
// asked without an origin and "no tab" when asked with one, and the send used
// to post that disagreement.
//
// Deliberately NOT minting a workflow for the tab here: that would bind the
// user's saved tab to an unrelated cloud workflow, which
// `AgentPanelRoot.test.ts` pins against ("does not adopt a minted workflow when
// a saved tab cloud lookup fails"). An unresolvable target fails the send
// visibly instead - the same refusal the target picker already gives - so the
// user sees why and can retry or re-pick, rather than being answered
// generically about a workflow they never chose.

const PORTRAIT_PATH = 'workflows/Portrait.json'
const PROMPT = 'Optimise my workflow for speed'

const AMBIGUOUS_CLOUD_LISTING: WorkflowListResponse = {
  // Both named `Portrait`, so the tab's name resolves to no single cloud id.
  data: [
    {
      id: 'a81718a4-02ae-41e6-ae85-000000000001',
      name: 'Portrait',
      created_at: '2026-10-02T00:00:00Z',
      created_by: 'test-user',
      latest_version: 1,
      updated_at: '2026-10-02T00:00:00Z'
    },
    {
      id: 'a81718a4-02ae-41e6-ae85-000000000002',
      name: 'Portrait',
      created_at: '2026-10-02T00:00:00Z',
      created_by: 'test-user',
      latest_version: 1,
      updated_at: '2026-10-02T00:00:00Z'
    }
  ],
  pagination: { has_more: false, limit: 100, offset: 0, total: 2 }
}

const EMPTY_THREADS: AgentThreadListResponse = {
  threads: [],
  pagination: { has_more: false, limit: 100, offset: 0, total: 0 }
}

test(
  'does not tell the server no workflow is selected while the composer names one',
  { tag: ['@cloud', '@agent'] },
  async ({ page, agentFlagEnabled }, testInfo) => {
    test.setTimeout(90_000)

    await page.route('**/api/workflows**', (route) =>
      route.fulfill(jsonRoute(AMBIGUOUS_CLOUD_LISTING))
    )

    // Registered before boot so the POST is captured whatever order the panel
    // reaches the turn endpoint in; an accepted turn is what the parent
    // revision produces here, and what this spec must not see.
    const posted: AgentPostMessageRequest[] = []
    await page.route('**/api/agent/threads/*/messages', (route: Route) => {
      const request = route.request()
      if (request.method() !== 'POST') return route.fulfill(jsonRoute([]))
      posted.push(zAgentPostMessageRequest.parse(request.postDataJSON()))
      const accepted: AgentTurnAccepted = {
        thread_id: '3c9f5a71-2d48-4b60-9e13-7a0c4d8e1f52',
        message_id: '8b2e4c60-1f39-4a75-b0d8-6e5a3c71d904',
        workflow_id: 'a81718a4-02ae-41e6-ae85-000000000001'
      }
      return route.fulfill({ ...jsonRoute(accepted), status: 202 })
    })
    await page.route('**/api/agent/threads', (route) =>
      route.fulfill(jsonRoute(EMPTY_THREADS))
    )

    await bootAgentApp(page, agentFlagEnabled)

    // One saved workflow on the account, and nothing bound to it: the user has
    // never picked it in the Agent's workflow chip.
    const savedFile: UserDataFullInfo = {
      path: PORTRAIT_PATH,
      modified: Date.now(),
      size: 1
    }
    await page.route('**/api/userdata?*', (route) => {
      const dir = new URL(route.request().url()).searchParams.get('dir')
      if (dir !== 'workflows') return route.fallback()
      return route.fulfill(
        jsonRoute([
          { ...savedFile, path: savedFile.path.slice('workflows/'.length) }
        ])
      )
    })
    await page.route('**/api/userdata/*', (route) => {
      const path = decodeURIComponent(
        new URL(route.request().url()).pathname.split('/userdata/')[1]
      )
      if (path !== PORTRAIT_PATH) return route.fallback()
      return route.fulfill(
        jsonRoute({
          last_node_id: 0,
          last_link_id: 0,
          nodes: [],
          links: [],
          groups: [],
          config: {},
          extra: {},
          version: 0.4
        })
      )
    })

    const topbar = new Topbar(page)
    const panel = new AgentPanel(page)

    await test.step('the user has that one workflow open, and only that one', async () => {
      await page.evaluate(async (path) => {
        const store = (window.app!.extensionManager as WorkspaceStore).workflow
        await store.syncWorkflows()
        const portrait = store.getWorkflowByPath(path)
        if (!portrait) throw new Error('Portrait workflow was not indexed')
        await store.openWorkflow(portrait)
      }, PORTRAIT_PATH)
      await expect(topbar.getActiveTab()).toContainText('Portrait')
    })

    await test.step('the Agent shows that workflow as the one it will work in', async () => {
      await panel.open()
      // A fresh chat follows the visible workflow, so the chip names it without
      // the user picking anything - this is the reporter's "clearly selected
      // the workflow inside the agent".
      await expect(panel.workflowPicker).toHaveText('Portrait')
    })

    await test.step('the user asks about it', async () => {
      await panel.sendMessage(PROMPT)
      await expect(panel.root.getByTestId('user-message-bubble')).toHaveText(
        PROMPT
      )
    })

    await test.step('the Agent says the target is unavailable instead of answering about no workflow', async () => {
      await expect(
        panel.root.getByText(enMessages.agent.targetNavigationUnavailable)
      ).toBeVisible()
    })

    await test.step('no turn described the selected tab to the server as no tab at all', () => {
      const unselected = posted.filter(
        (body) =>
          body.workflow_id === undefined &&
          body.current_tab === undefined &&
          body.current_tab_unbound !== true
      )
      expect(
        unselected,
        'a turn carrying none of workflow_id/current_tab/current_tab_unbound is read as "nothing selected" and answered generically (PM-1847)'
      ).toEqual([])
    })

    await test.step('the workflow the user chose is still the chosen one', async () => {
      await expect(panel.workflowPicker).toHaveText('Portrait')
      await expect(topbar.getActiveTab()).toContainText('Portrait')
    })

    await testInfo.attach('pm-1847-unresolved-target-notice', {
      body: await page.screenshot({
        path: testInfo.outputPath('pm-1847-unresolved-target-notice.png')
      }),
      contentType: 'image/png'
    })
  }
)
