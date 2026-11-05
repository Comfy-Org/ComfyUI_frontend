import type { Page } from '@playwright/test'

import type {
  AgentMessage,
  AgentThreadSummary,
  WorkflowListResponse
} from '@comfyorg/ingest-types'

import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { agentThreadPage } from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const SAVED_AT = '2026-09-22T10:00:00Z'

interface CloudWorkflow {
  id: string
  name: string
  content?: ComfyWorkflowJSON
}

export class AgentWorkflowChatsMock {
  constructor(
    private readonly chats: {
      workflows: CloudWorkflow[]
      threads: AgentThreadSummary[]
      transcripts: Record<string, AgentMessage[]>
    }
  ) {}

  async route(page: Page): Promise<void> {
    const { workflows, threads, transcripts } = this.chats
    const savedFiles: UserDataFullInfo[] = workflows.flatMap(
      ({ name, content }) =>
        content === undefined
          ? []
          : [
              {
                path: `${name}.json`,
                modified: Date.parse(SAVED_AT),
                size: JSON.stringify(content).length
              }
            ]
    )
    const cloudWorkflows: WorkflowListResponse = {
      data: workflows.map(({ id, name }) => ({
        id,
        name,
        created_at: SAVED_AT,
        updated_at: SAVED_AT,
        created_by: 'test-user-e2e',
        latest_version: 1
      })),
      pagination: {
        offset: 0,
        limit: 100,
        total: workflows.length,
        has_more: false
      }
    }

    await page.route('**/api/agent/threads?*', (route) => {
      const workflowId = new URL(route.request().url()).searchParams.get(
        'workflow_id'
      )
      return route.fulfill(
        jsonRoute(
          agentThreadPage(
            workflowId === null
              ? threads
              : threads.filter((thread) => thread.workflow_id === workflowId)
          )
        )
      )
    })
    await page.route('**/api/agent/threads/*/messages', (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      const threadId = new URL(route.request().url()).pathname.split('/')[4]
      return route.fulfill(jsonRoute(transcripts[threadId] ?? []))
    })
    await page.route('**/api/workflows?*', (route) =>
      route.fulfill(jsonRoute(cloudWorkflows))
    )
    await page.route(
      (url) =>
        url.pathname.endsWith('/api/userdata') &&
        url.searchParams.get('dir') === 'workflows',
      (route) => route.fulfill(jsonRoute(savedFiles))
    )
    for (const { name, content } of workflows) {
      if (content === undefined) continue
      await page.route(
        (url) =>
          decodeURIComponent(url.pathname).endsWith(
            `/api/userdata/workflows/${name}.json`
          ),
        (route) =>
          route.request().method() === 'GET'
            ? route.fulfill(jsonRoute(content))
            : route.fallback()
      )
    }
  }
}
