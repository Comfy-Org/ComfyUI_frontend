import { expect } from '@playwright/test'
import type { Route } from '@playwright/test'

import type {
  AgentPostMessageRequest,
  AgentThreadListResponse,
  WorkflowListResponse
} from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'

import type { UserDataFullInfo } from '@comfyorg/api-client/types'
import type { AgentTurnAccepted } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import type { WorkspaceStore } from '@e2e/types/globals'

const PORTRAIT_PATH = 'workflows/Portrait.json'
const PROMPT = 'Optimise my workflow for speed'
const AMBIGUITY_MESSAGE =
  'This tab cannot be matched to a unique cloud workflow. Rename same-named workflows or tabs, then try again.'

const AMBIGUOUS_CLOUD_LISTING: WorkflowListResponse = {
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
  'keeps the selected tab and draft when duplicate cloud workflows make its target ambiguous',
  { tag: ['@cloud', '@agent'] },
  async ({ page, agentFlagEnabled }) => {
    test.setTimeout(90_000)
    await page.route('**/api/workflows**', (route) =>
      route.fulfill(jsonRoute(AMBIGUOUS_CLOUD_LISTING))
    )

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
    await page.evaluate(async (path) => {
      const store = (window.app!.extensionManager as WorkspaceStore).workflow
      await store.syncWorkflows()
      const portrait = store.getWorkflowByPath(path)
      if (!portrait) throw new Error('Portrait workflow was not indexed')
      await store.openWorkflow(portrait)
    }, PORTRAIT_PATH)
    await expect(topbar.getActiveTab()).toContainText('Portrait')

    const panel = new AgentPanel(page)
    await panel.open()
    const composer = panel.composer
    await composer.fill(PROMPT)
    await panel.sendButton.click()

    await expect(panel.pendingSendError).toContainText(AMBIGUITY_MESSAGE)
    await expect(panel.userMessageBubbles).toHaveText([PROMPT])
    expect(posted).toEqual([])
    await expect(topbar.getActiveTab()).toContainText('Portrait')
  }
)
