import type { Page } from '@playwright/test'

import type {
  AgentMessage,
  AgentRunMode,
  AgentThreadListResponse,
  AgentThreadSummary,
  GlobalSetting
} from '@comfyorg/ingest-types'

import { AGENT_CONSENT_SETTING_ID } from '@/platform/settings/constants/agent'
import type {
  DraftIndexV2,
  DraftPayloadV2
} from '@/platform/workflow/persistence/base/draftTypes'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import { unsafeStorageScope } from '@/platform/workflow/persistence/testUtils/storageScope'
import { scopedOnboardingKey } from '@/workbench/extensions/agent/composables/agent/useOnboarding'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

export interface IdentityPersistenceSentinel {
  userId: string
  workspaceId: string
  threadId: string
  transcript: string
  bindingId: string
  tabPath: string
  draftName?: string
}

export class IdentityPersistenceHelper {
  constructor(private readonly page: Page) {}

  async mockAgentApi(
    sentinels: readonly IdentityPersistenceSentinel[]
  ): Promise<void> {
    const messages = sentinels.map(
      (sentinel): AgentMessage => ({
        id: `${sentinel.threadId}-message`,
        thread_id: sentinel.threadId,
        turn_id: sentinel.threadId,
        seq: 1,
        role: 'user',
        status: 'complete',
        content: { text: sentinel.transcript }
      })
    )
    const threads: AgentThreadListResponse = {
      threads: sentinels.map(
        (sentinel): AgentThreadSummary => ({
          id: sentinel.threadId,
          title: sentinel.transcript,
          preview: sentinel.transcript,
          workflow_id: sentinel.bindingId,
          status: 'active',
          message_count: 1,
          created_at: '2026-09-28T00:00:00Z',
          updated_at: '2026-09-28T00:00:00Z',
          last_message_at: '2026-09-28T00:00:00Z'
        })
      ),
      pagination: {
        offset: 0,
        limit: 100,
        total: sentinels.length,
        has_more: false
      }
    }
    await this.page.route('**/api/agent/threads', (route) =>
      route.fulfill(jsonRoute(threads))
    )
    await this.page.route('**/api/agent/threads/*/messages', (route) => {
      const threadId = new URL(route.request().url()).pathname.split('/').at(-2)
      return route.fulfill(
        jsonRoute(messages.filter((message) => message.thread_id === threadId))
      )
    })
    const runMode: AgentRunMode = {
      mode: 'ask_approval',
      credit_limit: null
    }
    await this.page.route('**/api/agent/run-mode', (route) =>
      route.fulfill(jsonRoute(runMode))
    )
    const consent: GlobalSetting = {
      key: AGENT_CONSENT_SETTING_ID,
      value: true,
      updated_at: '2026-09-28T00:00:00Z'
    }
    await this.page.route(
      `**/api/global-settings/${AGENT_CONSENT_SETTING_ID}`,
      (route) => route.fulfill(jsonRoute(consent))
    )
  }

  async seedAtStartup(
    sentinels: readonly IdentityPersistenceSentinel[]
  ): Promise<void> {
    const entries = this.storageEntries(sentinels)
    await this.page.addInitScript((storageEntries) => {
      const seededKey = 'e2e-identity-persistence-seeded'
      if (sessionStorage.getItem(seededKey) === 'true') return
      sessionStorage.setItem(seededKey, 'true')
      for (const [key, value] of storageEntries)
        localStorage.setItem(key, value)
    }, entries)
  }

  async seed(sentinels: readonly IdentityPersistenceSentinel[]): Promise<void> {
    const entries = this.storageEntries(sentinels)
    await this.page.evaluate((storageEntries) => {
      for (const [key, value] of storageEntries)
        localStorage.setItem(key, value)
    }, entries)
  }

  private storageEntries(
    sentinels: readonly IdentityPersistenceSentinel[]
  ): Array<[string, string]> {
    return sentinels.flatMap((sentinel) => {
      const scope = unsafeStorageScope(
        `${sentinel.userId}:${sentinel.workspaceId}`
      )
      const onboardingKey = scopedOnboardingKey(
        sentinel.userId,
        sentinel.workspaceId
      )
      if (onboardingKey === null)
        throw new Error('Identity scope is incomplete')

      const updatedAt = Date.now()
      const entries: Array<[string, string]> = [
        [StorageKeys.agentThread(scope), sentinel.threadId],
        [
          StorageKeys.agentWorkflowTabBindings(scope),
          JSON.stringify({
            [sentinel.bindingId]: {
              tabPath: sentinel.tabPath,
              graphId: null,
              confirmedAt: updatedAt
            }
          })
        ],
        [onboardingKey, 'true']
      ]
      if (sentinel.draftName === undefined) return entries

      const path = `workflows/${sentinel.draftName}.json`
      const draftKey = StorageKeys.draftKey(path)
      const index: DraftIndexV2 = {
        v: 2,
        updatedAt,
        order: [draftKey],
        entries: {
          [draftKey]: {
            path,
            name: `${sentinel.draftName}.json`,
            isTemporary: true,
            updatedAt
          }
        }
      }
      const payload: DraftPayloadV2 = {
        data: JSON.stringify({
          last_node_id: 0,
          last_link_id: 0,
          nodes: [],
          links: [],
          groups: [],
          config: {},
          extra: { identitySentinel: sentinel.draftName },
          version: 0.4
        }),
        updatedAt
      }
      entries.push(
        [StorageKeys.draftIndex(scope), JSON.stringify(index)],
        [StorageKeys.draftPayload(path, scope), JSON.stringify(payload)],
        [
          StorageKeys.lastActivePath(scope),
          JSON.stringify({ workspaceId: scope, path })
        ],
        [
          StorageKeys.lastOpenPaths(scope),
          JSON.stringify({
            workspaceId: scope,
            paths: [path],
            activeIndex: 0
          })
        ]
      )
      return entries
    })
  }
}
