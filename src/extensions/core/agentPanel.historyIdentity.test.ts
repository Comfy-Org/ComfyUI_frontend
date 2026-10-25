import type { AgentThreadListResponse } from '@comfyorg/ingest-types'
import { fetchRequests, respondToFetch } from '@comfyorg/test-utils/fetch'
import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, defineComponent, h, nextTick } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { firebaseIdentity } from '@/platform/auth/firebaseIdentity'
import type * as DistributionTypes from '@/platform/distribution/types'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'
import type { ComfyExtension } from '@/types/comfy'
import { replayIdentityPort } from '@/utils/__tests__/stubAccountIdentityPort'
import { useAgentChatHistoryRefresh } from '@/workbench/extensions/agent/composables/agent/useAgentChatHistoryRefresh'
import { useAgentDockMount } from '@/workbench/extensions/agent/composables/useAgentDockMount'
import { createAgentRestClient } from '@/workbench/extensions/agent/services/agent/agentRestClient'
import { useAgentChatHistoryStore } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

vi.mock(import('firebase/auth'))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(
  import('@/platform/distribution/types'),
  (): typeof DistributionTypes => ({
    DISTRIBUTION: 'cloud',
    isCloud: true,
    isDesktop: false,
    isNightly: false
  })
)
vi.mock(
  import('@/renderer/extensions/firstRunTour/gettingStarted/firstRunEntry'),
  () => ({
    useFirstRunEntry: () =>
      fromPartial({
        firstRunHoldsScreen: computed(() => false),
        whenStartupDecided: async () => false
      })
  })
)
vi.mock(
  import('@/workbench/extensions/agent/services/agent/workflowTabActivityTracker'),
  () => ({ registerWorkflowTabActivityTracker: vi.fn(() => () => {}) })
)
const mocks = vi.hoisted(() => ({ capturedExtensions: [] as ComfyExtension[] }))
vi.mock(import('@/services/extensionService'), () => ({
  useExtensionService: () =>
    fromPartial({
      registerExtension: (extension: ComfyExtension) => {
        mocks.capturedExtensions.push(extension)
      }
    })
}))
const { registerAgentPanelExtension } = await import('./agentPanel')
registerAgentPanelExtension()

function identityHistoryPage(
  id: string,
  hasMore = false
): AgentThreadListResponse {
  return {
    threads: [
      {
        id,
        title: id,
        preview: '',
        workflow_id: '',
        status: 'active',
        message_count: 1,
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
        last_message_at: '2026-10-01T00:00:00Z'
      }
    ],
    pagination: {
      offset: 0,
      limit: 100,
      total: 2,
      has_more: hasMore,
      next_cursor: hasMore ? 'identity-page-2' : undefined
    }
  }
}

describe('AgentPanel history during account transitions', () => {
  it.for([
    {
      change: 'the same account is reported again',
      nextId: 'account-a',
      keepsPanel: true
    },
    { change: 'the account changes', nextId: 'account-b', keepsPanel: false },
    { change: 'the account signs out', nextId: null, keepsPanel: false }
  ])(
    'settles a pending history page safely when $change',
    async ({ nextId, keepsPanel }) => {
      const accountA = fromPartial<User>({
        uid: 'account-a',
        getIdToken: vi.fn(async () => 'test-token')
      })
      const identity = replayIdentityPort(() => accountA, 'sync')
      vi.spyOn(firebaseIdentity, 'onUserChanged').mockImplementation(
        identity.register
      )
      const auth = useAuthStore()
      const currentUserService = vi.mocked(useCurrentUser())
      currentUserService.resolvedUserInfo = computed(() =>
        auth.userId ? { id: auth.userId } : null
      )
      currentUserService.isLoggedIn = computed(() => Boolean(auth.userId))
      currentUserService.isAuthInitialized = computed(() => true)
      const panelStore = useAgentPanelStore()
      panelStore.isOpen = true
      vi.mocked(useAgentConsentStore().load).mockResolvedValue(true)
      const oldFeatures = api.serverFeatureFlags.value
      const oldFlagsSettled = api.serverFeatureFlagsSettled.value
      onTestFinished(() => {
        api.socket?.close()
        api.socket = null
        api.serverFeatureFlags.value = oldFeatures
        api.serverFeatureFlagsSettled.value = oldFlagsSettled
      })
      api.serverFeatureFlags.value = { agent: { state: 'ready', reason: null } }
      vi.stubGlobal(
        'WebSocket',
        vi.fn(function () {
          return {
            readyState: 1,
            send: vi.fn(),
            close: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
          }
        })
      )
      const resetSocket = vi.spyOn(api, 'resetSocket')
      const history = useAgentChatHistoryStore()
      const onFailure = vi.fn()
      let refreshPromise:
        | ReturnType<
            ReturnType<typeof useAgentChatHistoryRefresh>['refreshHistory']
          >
        | undefined
      let secondPageSignal: AbortSignal | null | undefined
      let resolveSecondPage!: (response: Response) => void
      const secondPage = new Promise<Response>((resolve) => {
        resolveSecondPage = resolve
      })
      const threadRoute = /\/api\/agent\/threads\?/
      const secondPageRoute = /\/api\/agent\/threads\?.*after=identity-page-2/
      respondToFetch(threadRoute, () =>
        Response.json(identityHistoryPage('account-a-page-1', true))
      )
      respondToFetch(
        secondPageRoute,
        (_input, init) => {
          secondPageSignal = init?.signal
          return secondPage
        },
        { times: 1 }
      )
      const HistoryLoader = defineComponent({
        setup() {
          const rest = createAgentRestClient()
          const { refreshHistory } = useAgentChatHistoryRefresh({
            listThreads: rest.listThreads,
            history,
            untitledChat: () => 'Untitled',
            onFailure
          })
          refreshPromise = refreshHistory()
          return () => h('div', { 'data-testid': 'history-owner' })
        }
      })
      const setupExtension = mocks.capturedExtensions.find(
        (ext) => ext.name === 'Comfy.AgentPanel'
      )?.setup
      assert.exists(setupExtension)
      let extensionSetup: ReturnType<typeof setupExtension> | undefined =
        undefined
      const Host = defineComponent({
        setup() {
          extensionSetup = setupExtension(
            fromPartial<Parameters<NonNullable<ComfyExtension['setup']>>[0]>({})
          )
          const { docked } = useAgentDockMount()
          return () => (docked.value ? h(HistoryLoader) : null)
        }
      })
      render(Host)
      await extensionSetup
      await screen.findByTestId('history-owner')
      await vi.waitFor(() =>
        expect(fetchRequests(secondPageRoute)).toHaveLength(1)
      )
      assert.exists(refreshPromise)
      assert.exists(secondPageSignal)
      expect(history.sessions).toEqual([])

      identity.emit(
        nextId === null
          ? null
          : fromPartial<User>({
              uid: nextId,
              getIdToken: vi.fn(async () => 'test-token')
            })
      )
      resolveSecondPage(Response.json(identityHistoryPage('account-a-page-2')))
      await refreshPromise
      await nextTick()

      expect(auth.userId ?? null).toBe(nextId)
      expect(resetSocket).toHaveBeenCalledTimes(keepsPanel ? 0 : 1)
      expect(panelStore.isVisible).toBe(keepsPanel)
      expect(screen.queryByTestId('history-owner') !== null).toBe(keepsPanel)
      expect(secondPageSignal.aborted).toBe(!keepsPanel)
      expect(history.sessions.map(({ id }) => id)).toEqual(
        keepsPanel ? ['account-a-page-1', 'account-a-page-2'] : []
      )
      expect(onFailure).not.toHaveBeenCalled()
    }
  )
})
