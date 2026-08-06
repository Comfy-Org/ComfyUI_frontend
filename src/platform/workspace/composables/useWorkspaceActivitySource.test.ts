import { createTestingPinia } from '@pinia/testing'
import { render, waitFor } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  BillingEvent,
  BillingEventsResponse
} from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { useWorkspaceActivitySource } from './useWorkspaceActivitySource'

const { mockWorkspaceRole } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')
  return { mockWorkspaceRole: ref<'owner' | 'member'>('owner') }
})

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({ workspaceRole: mockWorkspaceRole })
}))

function billingEvent(id: string, userId = 'cloud-user-1'): BillingEvent {
  return {
    event_id: id,
    event_type: 'cloud_workflow_executed',
    createdAt: '2026-07-14T12:00:00Z',
    params: { user_id: userId }
  }
}

function billingResponse(
  events: BillingEvent[],
  page = 1,
  totalPages = 1
): BillingEventsResponse {
  return {
    events,
    page,
    limit: 100,
    total: events.length,
    totalPages
  }
}

function setup() {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    stubActions: true,
    initialState: {
      teamWorkspace: {
        activeWorkspaceId: 'workspace-1',
        workspaces: [
          {
            id: 'workspace-1',
            name: 'Workspace',
            type: 'team',
            role: mockWorkspaceRole.value,
            created_at: '2026-01-01T00:00:00Z',
            joined_at: '2026-01-01T00:00:00Z',
            isSubscribed: true,
            subscriptionPlan: null,
            subscriptionTier: null,
            pendingInvites: [],
            members: [
              {
                id: 'cloud-user-1',
                name: 'Ada Lovelace',
                email: 'ada@example.com',
                joinDate: new Date('2026-01-01T00:00:00Z'),
                role: 'member',
                isOriginalOwner: false
              }
            ]
          }
        ]
      }
    }
  })
  setActivePinia(pinia)

  let source!: ReturnType<typeof useWorkspaceActivitySource>
  const Harness = defineComponent({
    setup() {
      source = useWorkspaceActivitySource()
      return () => h('div')
    }
  })
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })

  render(Harness, { global: { plugins: [pinia, i18n] } })
  return { source, workspaceStore: useTeamWorkspaceStore() }
}

describe('useWorkspaceActivitySource', () => {
  beforeEach(() => {
    mockWorkspaceRole.value = 'owner'
    vi.restoreAllMocks()
  })

  it.for([
    { role: 'owner', scope: 'workspace' },
    { role: 'member', scope: 'self' }
  ] as const)(
    'requests $role activity with $scope scope',
    async ({ role, scope }) => {
      mockWorkspaceRole.value = role
      const getBillingEvents = vi
        .spyOn(workspaceApi, 'getBillingEvents')
        .mockResolvedValue(billingResponse([]))

      const { source } = setup()

      await waitFor(() => expect(source.isLoading.value).toBe(false))
      expect(getBillingEvents).toHaveBeenCalledWith({
        page: 1,
        limit: 100,
        scope
      })
    }
  )

  it('loads every page and resolves Cloud user IDs to member names', async () => {
    const getBillingEvents = vi
      .spyOn(workspaceApi, 'getBillingEvents')
      .mockResolvedValueOnce(billingResponse([billingEvent('event-1')], 1, 2))
      .mockResolvedValueOnce(billingResponse([billingEvent('event-2')], 2, 2))

    const { source, workspaceStore } = setup()

    await waitFor(() => expect(source.events.value).toHaveLength(2))
    expect(workspaceStore.ensureMembersLoaded).toHaveBeenCalledOnce()
    expect(getBillingEvents).toHaveBeenNthCalledWith(2, {
      page: 2,
      limit: 100,
      scope: 'workspace'
    })
    expect(
      source.events.value.map(({ id, userName }) => [id, userName])
    ).toEqual([
      ['event-1', 'Ada Lovelace'],
      ['event-2', 'Ada Lovelace']
    ])
  })

  it('clears stale events on failure and supports retry', async () => {
    const failure = new Error('request failed')
    const getBillingEvents = vi
      .spyOn(workspaceApi, 'getBillingEvents')
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(billingResponse([billingEvent('event-1')]))

    const { source } = setup()

    await waitFor(() => expect(source.error.value).toBe(failure))
    expect(source.events.value).toEqual([])
    expect(source.isLoading.value).toBe(false)

    await source.refresh()

    expect(getBillingEvents).toHaveBeenCalledTimes(2)
    expect(source.error.value).toBeNull()
    expect(source.events.value.map(({ id }) => id)).toEqual(['event-1'])
    expect(source.isLoading.value).toBe(false)
  })
})
