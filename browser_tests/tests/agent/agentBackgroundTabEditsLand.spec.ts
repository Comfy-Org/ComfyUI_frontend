import { expect } from '@playwright/test'

import type { UserDataFullInfo } from '@comfyorg/api-client/types'
import type { WorkflowListResponse } from '@comfyorg/ingest-types'

import {
  agentConversationTest as test,
  THREAD_ID
} from '@e2e/fixtures/agentConversationFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import {
  agentThreadPage,
  agentThreadSummary,
  agentUserTranscript
} from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const CASE = 'agent-rec-set-widget-existing'
const A_NAME = 'Unsaved Workflow'
const B = {
  id: '3c1e5b7a-9d2f-4e8b-a6c4-0f1e2d3c4b5a',
  name: 'Other Study',
  threadId: '7a2b4c6d-8e0f-4a1b-9c3d-5e7f9a1b3c5d',
  request: 'Tidy up the other study'
}
const SAVED_AT = '2026-11-02T10:00:00Z'
const BACKGROUND_NODES = [
  { id: 801, title: 'b1', x: 1400 },
  { id: 802, title: 'b2', x: 1700 },
  { id: 803, title: 'b3', x: 2000 }
]
const EMPTY_GRAPH = {
  last_node_id: 0,
  last_link_id: 0,
  nodes: [],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

function backgroundEdits(): RecordedGraphOperation[] {
  const type = 'EmptyLatentImage'
  return BACKGROUND_NODES.flatMap(({ id, title, x }) => [
    {
      op: 'add_node',
      node_id: id,
      class_type: type,
      pos: [x, 600],
      node: {
        id,
        type,
        pos: [x, 600],
        size: [240, 134],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [],
        outputs: [{ name: 'LATENT', type: 'LATENT', links: [] }],
        properties: {},
        widgets_values: [512, 512, 1]
      }
    },
    { op: 'set_node_field', node_id: id, field: 'title', value: title }
  ])
}

test.describe(
  'Agent edits to a background workflow tab',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE })

    test('are on the canvas when the user returns to that tab', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(120_000)
      const panel = new AgentPanel(page)
      const topbar = agentConversation.topbar
      const aId = agentConversation.conversation.workflow.id
      const aRequest = agentConversation.conversation.turns[0].request.content

      await test.step('agent edits workflow A', () =>
        agentConversation.runTurns())

      await test.step('workflow B has a saved chat of its own', async () => {
        agentConversation.serveWorkflow(B.id, {
          ...agentConversation.conversation.workflow.seed,
          nodes: [],
          links: []
        })
        const threads = [
          agentThreadSummary(THREAD_ID, 'Workflow A chat', {
            preview: aRequest,
            workflow_id: aId,
            last_message_at: '2026-11-02T09:00:00Z'
          }),
          agentThreadSummary(B.threadId, 'Workflow B chat', {
            preview: B.request,
            workflow_id: B.id,
            last_message_at: SAVED_AT
          })
        ]
        const transcripts = {
          [THREAD_ID]: agentUserTranscript(THREAD_ID, aId, aRequest),
          [B.threadId]: agentUserTranscript(B.threadId, B.id, B.request)
        }
        const cloudWorkflows: WorkflowListResponse = {
          data: [
            { id: aId, name: A_NAME },
            { id: B.id, name: B.name }
          ].map(({ id, name }) => ({
            id,
            name,
            created_at: SAVED_AT,
            updated_at: SAVED_AT,
            created_by: 'test-user-e2e',
            latest_version: 1
          })),
          pagination: { offset: 0, limit: 100, total: 2, has_more: false }
        }
        const savedFiles: UserDataFullInfo[] = [A_NAME, B.name].map((name) => ({
          path: `${name}.json`,
          modified: Date.parse(SAVED_AT),
          size: 1
        }))
        await page.route('**/api/agent/threads?*', (route) => {
          const workflowId = new URL(route.request().url()).searchParams.get(
            'workflow_id'
          )
          return route.fulfill(
            jsonRoute(
              agentThreadPage(
                workflowId === null
                  ? threads
                  : threads.filter((t) => t.workflow_id === workflowId)
              )
            )
          )
        })
        await page.route('**/api/agent/threads/*/messages', (route) => {
          if (route.request().method() !== 'GET') return route.fallback()
          const threadId = new URL(route.request().url()).pathname.split('/')[4]
          return route.fulfill(jsonRoute(transcripts[threadId] ?? []))
        })
        await page.route('**/api/workflows**', (route) =>
          route.fulfill(jsonRoute(cloudWorkflows))
        )
        await page.route(
          (url) =>
            url.pathname.endsWith('/api/userdata') &&
            url.searchParams.get('dir') === 'workflows',
          (route) => route.fulfill(jsonRoute(savedFiles))
        )
        await page.route(
          (url) =>
            decodeURIComponent(url.pathname).endsWith(
              `/api/userdata/workflows/${B.name}.json`
            ),
          (route) =>
            route.request().method() === 'GET'
              ? route.fulfill(jsonRoute(EMPTY_GRAPH))
              : route.fallback()
        )
      })

      await test.step('user opens workflow B and its chat', async () => {
        await panel.historyButton.click()
        await panel.root
          .getByRole('button', { name: 'Workflow B chat', exact: true })
          .click()
        await expect(panel.userMessageBubbles).toHaveText([B.request])
        await expect(
          topbar.getWorkflowTab(B.name).and(topbar.getActiveTab())
        ).toBeVisible()
      })

      await test.step('user returns to A, then switches to B by its tab', async () => {
        await topbar.getWorkflowTab(A_NAME).click()
        await expect(panel.userMessageBubbles).toHaveText([aRequest])
        await topbar.getWorkflowTab(B.name).click()
        await expect(panel.userMessageBubbles).toHaveText([B.request])
        await expect(
          topbar.getWorkflowTab(B.name).and(topbar.getActiveTab())
        ).toBeVisible()
      })

      await test.step('agent adds three titled nodes to A while B is shown', () =>
        agentConversation.applyOpsOnHostUnsent(backgroundEdits()))

      await test.step('returning to A shows every background edit', async () => {
        await topbar.getWorkflowTab(A_NAME).click()
        await expect(
          topbar.getWorkflowTab(A_NAME).and(topbar.getActiveTab())
        ).toBeVisible()
        await expect(panel.userMessageBubbles).toHaveText([aRequest])
        for (const { id, title } of BACKGROUND_NODES)
          await expect(
            agentConversation.vueNodes
              .getNodeLocator(String(id))
              .getByTestId('node-title')
          ).toHaveText(title)
      })
    })
  }
)
