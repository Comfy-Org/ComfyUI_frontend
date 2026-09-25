import { expect } from '@playwright/test'

import type {
  AgentMessage,
  AgentThreadListResponse,
  WorkflowListResponse
} from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import type { WorkspaceStore } from '@e2e/types/globals'

const BINDING_KEY = StorageKeys.agentWorkflowTabBindings('personal')
const THREAD_KEY = StorageKeys.agentThread('personal')
const PORTRAIT_PATH = 'workflows/Portrait.json'
const TARGET_ID = 'a81718a4-02ae-41e6-ae85-000000000001'
const THREAD_ID = '6f4b1e2a-7c3d-4e5f-8a9b-0c1d2e3f4a5b'
const TURN_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'

// Regression source: https://github.com/Comfy-Org/ComfyUI_frontend/pull/17518#discussion_r4017443654
test(
  'does not select an unrelated saved tab for a duplicated cloud workflow name',
  { tag: ['@cloud', '@agent'] },
  async ({ page, agentFlagEnabled }, testInfo) => {
    test.setTimeout(90_000)
    await page.addInitScript(
      ([bindingKey, threadKey, targetId, path, threadId]) => {
        localStorage.setItem(
          bindingKey,
          JSON.stringify({
            [targetId]: {
              tabPath: path,
              graphId: null,
              confirmedAt: Date.now()
            }
          })
        )
        localStorage.setItem(threadKey, threadId)
      },
      [BINDING_KEY, THREAD_KEY, TARGET_ID, PORTRAIT_PATH, THREAD_ID] as const
    )

    const cloudWorkflows: WorkflowListResponse = {
      data: [
        {
          id: TARGET_ID,
          name: 'image_z_image_turbo',
          created_at: '2026-09-19T00:00:00Z',
          created_by: 'test-user',
          latest_version: 1,
          updated_at: '2026-09-19T00:00:00Z'
        },
        {
          id: 'a81718a4-02ae-41e6-ae85-000000000002',
          name: 'image_z_image_turbo',
          created_at: '2026-09-19T00:00:00Z',
          created_by: 'test-user',
          latest_version: 1,
          updated_at: '2026-09-19T00:00:00Z'
        },
        {
          id: 'a81718a4-02ae-41e6-ae85-000000000003',
          name: 'Portrait',
          created_at: '2026-09-19T00:00:00Z',
          created_by: 'test-user',
          latest_version: 1,
          updated_at: '2026-09-19T00:00:00Z'
        }
      ],
      pagination: {
        has_more: false,
        limit: 100,
        offset: 0,
        total: 3
      }
    }
    await page.route('**/api/workflows**', (route) =>
      route.fulfill(jsonRoute(cloudWorkflows))
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

    const history: AgentMessage[] = [
      {
        id: 'user-1',
        thread_id: THREAD_ID,
        turn_id: TURN_ID,
        seq: 1,
        role: 'user',
        status: 'complete',
        workflow_id: TARGET_ID,
        content: { text: 'Earlier request' }
      }
    ]
    const threads: AgentThreadListResponse = {
      threads: [
        {
          id: THREAD_ID,
          title: 'Duplicate target',
          preview: 'Earlier request',
          workflow_id: TARGET_ID,
          status: 'active',
          message_count: 1,
          created_at: '2026-09-19T00:00:00Z',
          updated_at: '2026-09-19T00:00:00Z',
          last_message_at: '2026-09-19T00:00:00Z'
        }
      ],
      pagination: { offset: 0, limit: 100, total: 1, has_more: false }
    }
    await page.route('**/api/agent/threads', (route) =>
      route.fulfill(jsonRoute(threads))
    )
    await page.route('**/api/agent/threads/*/messages', (route) =>
      route.fulfill(jsonRoute(history))
    )

    const topbar = new Topbar(page)
    await expect(topbar.getActiveTab()).toContainText('Unsaved Workflow')
    await page.evaluate(async (path) => {
      const store = (window.app!.extensionManager as WorkspaceStore).workflow
      await store.syncWorkflows()
      const portrait = store.getWorkflowByPath(path)
      if (!portrait) throw new Error('Portrait workflow was not indexed')
      await store.openWorkflow(portrait)
    }, PORTRAIT_PATH)
    await expect(topbar.getActiveTab()).toContainText('Portrait')
    expect(
      await page.evaluate(
        ([key, workflowId]) => {
          const stored = JSON.parse(
            localStorage.getItem(key) ?? '{}'
          ) as Record<string, { tabPath?: unknown }>
          return stored[workflowId]?.tabPath
        },
        [BINDING_KEY, TARGET_ID] as const
      )
    ).toBe(PORTRAIT_PATH)

    await page
      .getByRole('button', { name: enMessages.agent.entryButton, exact: true })
      .click()
    const panel = page.locator('#agent-panel-root')
    await expect(panel).toBeVisible()
    await expect(panel.getByTestId('user-message-bubble')).toHaveText([
      'Earlier request'
    ])

    await expect(topbar.getActiveTab()).toContainText('Portrait')
    await expect(
      panel.getByText(enMessages.agent.selectWorkflowForAgent)
    ).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(
          ([key, workflowId]) => {
            const stored: unknown = JSON.parse(
              localStorage.getItem(key) ?? 'null'
            )
            return (
              typeof stored === 'object' &&
              stored !== null &&
              Object.hasOwn(stored, workflowId)
            )
          },
          [BINDING_KEY, TARGET_ID] as const
        )
      )
      .toBe(false)
    await expect(topbar.getActiveTab()).toContainText('Portrait')

    await testInfo.attach('duplicate-name-portrait-tab', {
      body: await page.screenshot({
        path: testInfo.outputPath('duplicate-name-portrait-tab.png')
      }),
      contentType: 'image/png'
    })
  }
)
