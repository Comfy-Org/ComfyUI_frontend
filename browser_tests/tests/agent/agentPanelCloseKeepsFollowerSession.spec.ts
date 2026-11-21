import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

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

const WORKFLOW_ID = 'c38f1b70-5d92-4e16-a7c4-9e0b35d8216f'
const THREAD_ID = 'e6b40c25-9173-4a08-bd5f-1c72a9e30d64'
const MESSAGE_ID = '2d7a1e63-48b5-4c90-9f31-5b8c0d6e2a17'

const CATALOG: WidgetCatalog = {
  types: { MarkdownNote: { widget_order: ['text'] } }
}
const SEED: WorkflowJSON = { nodes: [], links: [] }
const EMPTY_DOCUMENT_VECTOR = 'AA=='

test.describe(
  'Agent panel closed and reopened with a bound document',
  { tag: ['@cloud', '@agent'] },
  () => {
    let hostSocket: AgentFollowerHostSocket
    let agentPanel: AgentPanel
    let panel: Locator

    test.setTimeout(60_000)

    test.beforeEach(async ({ page }) => {
      let savedName: string | undefined
      const host = new HostDoc(WORKFLOW_ID, SEED, CATALOG)
      hostSocket = new AgentFollowerHostSocket(page, WORKFLOW_ID, host)

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

      agentPanel = new AgentPanel(page)
      panel = await agentPanel.open(30_000)

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
        await expect.poll(() => hostSocket.subscribeCount()).toBe(1)
      })
    })

    test('keeps the follower session instead of cold-seeding a new replica', async () => {
      await test.step('close the panel', async () => {
        await agentPanel.closeButton.click()
        await expect(panel).toBeHidden()
      })

      await test.step('reopen it and find the agent usable again', async () => {
        await agentPanel.open(30_000)
        await expect(panel).toBeVisible()
        await expect(
          panel.getByRole('textbox', { name: AGENT_COMPOSER_LABEL })
        ).toBeEditable()
      })

      await test.step('the resubscribe resumes the surviving replica, not an empty one', async () => {
        await expect
          .poll(
            () =>
              hostSocket
                .clientDocFrames()
                .filter((frame) => frame.type === 'doc_subscribe').length
          )
          .toBe(2)
        const subscribes = hostSocket
          .clientDocFrames()
          .filter((frame) => frame.type === 'doc_subscribe')
        expect(subscribes[0].stateVector).not.toBeNull()
        expect(
          subscribes[1].stateVector,
          'the reopened panel asked for a delta, not a whole-document cold seed'
        ).not.toBe(EMPTY_DOCUMENT_VECTOR)
        expect(subscribes[1].stateVector).not.toBe(subscribes[0].stateVector)
        expect(hostSocket.refusedSubscribeCount()).toBe(0)
        expect(hostSocket.connectionCount()).toBe(1)
      })
    })
  }
)
