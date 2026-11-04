import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { WorkflowListResponse } from '@comfyorg/ingest-types'
import type { UserDataFullInfo } from '@comfyorg/api-client/types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { emptyAgentThreadList } from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { AGENT_COMPOSER_LABEL } from '@e2e/fixtures/utils/agentComposerLabel'

/**
 * Stage 1a of
 * `docs/adr/CRDT-FOLLOWER-0052-the-workflow-document-owns-the-follower-session.md`:
 * the agent transport is owned by the page, not by the Agent panel.
 *
 * Closing the panel is an ordinary component unmount (`DockedAgentPanel.vue`
 * renders the root under `v-if`). The panel used to construct the agent event
 * source and the doc-frame transport in its own `setup` and destroy the
 * transport in `onBeforeUnmount`. The event source reference-counts its socket
 * by listener count and disconnects at zero, so dropping the doc-frame tap and
 * the session stream in the same teardown closed the socket outright — and
 * reopening the panel had to dial a fresh one, re-reading credentials and
 * paying reconnect backoff for a panel the user only toggled.
 *
 * This pins the connection count across a close/reopen. It is deliberately a
 * narrow claim: Stage 1a moves the transport only, so the replica is still
 * panel-owned and the deleted-while-closed divergence in the ADR's cost A is
 * NOT fixed here — that is Stage 1b plus Stage 3. Asserting more than the
 * surviving connection would be asserting something this stage does not do.
 */

const WORKFLOW_ID = 'b71c0f84-3a5e-4d21-9f08-5c7b2e1a4d33'
const THREAD_ID = 'd48e2b17-6c90-4a3f-8e51-2f9c7b0a6e14'
const MESSAGE_ID = '1f6c3a92-7b48-4e05-9c2d-3a8b5e7f1002'

const CATALOG: WidgetCatalog = {
  types: { MarkdownNote: { widget_order: ['text'] } }
}
const SEED: WorkflowJSON = { nodes: [], links: [] }

test.describe(
  'Agent panel closed and reopened',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('keeps the agent connection the panel was only hiding', async ({
      page
    }) => {
      test.setTimeout(60_000)
      const host = new HostDoc(WORKFLOW_ID, SEED, CATALOG)
      const hostSocket = new AgentFollowerHostSocket(page, WORKFLOW_ID, host)

      await page.route('**/api/agent/threads?*', (route) =>
        route.fulfill(jsonRoute(emptyAgentThreadList()))
      )
      await page.route('**/api/agent/threads/*/messages', (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status: 202,
            contentType: 'application/json',
            body: JSON.stringify({
              thread_id: THREAD_ID,
              message_id: MESSAGE_ID,
              workflow_id: WORKFLOW_ID
            })
          })
        }
        return route.fulfill(jsonRoute([]))
      })
      await hostSocket.install()

      await bootAgentApp(page, true, {
        settings: { 'Comfy.Graph.CanvasInfo': false }
      })

      const agentPanel = new AgentPanel(page)
      const panel = await agentPanel.open(30_000)

      let savedName: string | undefined
      await page.route('**/api/userdata/*', (route) => {
        const request = route.request()
        const path = decodeURIComponent(
          new URL(request.url()).pathname.split('/userdata/')[1]
        )
        if (request.method() !== 'POST' || !path.startsWith('workflows/'))
          return route.fallback()
        savedName = path.slice('workflows/'.length, -'.json'.length)
        const saved: UserDataFullInfo = {
          path,
          modified: Date.now(),
          size: request.postDataBuffer()?.length ?? 0
        }
        return route.fulfill(jsonRoute(saved))
      })
      await page.route('**/api/workflows?*', (route) => {
        const workflows: WorkflowListResponse = {
          data:
            savedName === undefined
              ? []
              : [
                  {
                    id: WORKFLOW_ID,
                    name: savedName,
                    created_at: '2026-09-01T00:00:00Z',
                    updated_at: '2026-09-01T00:00:00Z',
                    created_by: 'test-user-e2e',
                    latest_version: 1
                  }
                ],
          pagination: {
            has_more: false,
            limit: 100,
            offset: 0,
            total: savedName === undefined ? 0 : 1
          }
        }
        return route.fulfill(jsonRoute(workflows))
      })

      await test.step('bind the workflow and run a turn so a follower session exists', async () => {
        const picker = panel.getByRole('button', {
          name: enMessages.agent.switchWorkflow
        })
        await picker.click()
        await page
          .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
          .click()
        await expect(picker).toHaveText('Unsaved Workflow')
        await expect.poll(() => hostSocket.connectionCount()).toBe(1)

        // Binding alone does not start the follower; the turn's active-tab
        // frame is what makes it subscribe. The subscribe matters here because
        // the doc-frame tap is what holds the socket open — the event source
        // closes on its last listener, so a spec where the follower never
        // subscribed would go red on the fix and the parent alike.
        const composer = panel.getByRole('textbox', {
          name: AGENT_COMPOSER_LABEL
        })
        await composer.fill('Add a note to the canvas.')
        await panel.getByRole('button', { name: enMessages.agent.send }).click()
        await expect(
          panel.getByText('Add a note to the canvas.').first()
        ).toBeVisible()

        hostSocket.send({
          type: 'agent_active_tab',
          data: {
            workflow_id: WORKFLOW_ID,
            name: 'Unsaved Workflow',
            thread_id: THREAD_ID,
            message_id: MESSAGE_ID
          }
        })
        await expect.poll(() => hostSocket.subscribeCount()).toBeGreaterThan(0)
      })

      await test.step('close the panel', async () => {
        await agentPanel.closeButton.click()
        await expect(panel).toBeHidden()
      })

      await test.step('reopen it and find the agent still usable', async () => {
        await agentPanel.open(30_000)
        await expect(panel).toBeVisible()
        await expect(
          panel.getByRole('textbox', { name: AGENT_COMPOSER_LABEL })
        ).toBeEditable()
      })

      await test.step('the connection was never dropped and redialled', async () => {
        // The assertion that fails on the parent: there, panel teardown
        // destroyed the transport, the socket closed with its last listener,
        // and the remount opened connection 2. `toBe` rather than a poll with
        // a bound, because a second connection appearing late is the same
        // defect arriving slowly.
        await expect.poll(() => hostSocket.connectionCount()).toBe(1)
        expect(hostSocket.refusedConnectionCount()).toBe(0)
      })
    })
  }
)
