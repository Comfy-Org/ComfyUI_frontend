import type { GlobalSetting } from '@comfyorg/ingest-types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'

import { useAgentDockMount } from './useAgentDockMount'

vi.mock(import('firebase/auth'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@comfyorg/telemetry/reportError'))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/platform/billing/composables/useBillingContext'))

const accountApi = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  header: vi.fn()
}))
vi.mock(import('@/platform/settings/globalSettingsApi'), () => ({
  getGlobalSetting: accountApi.get,
  setGlobalSetting: accountApi.set
}))
vi.mock(
  import('@/workbench/extensions/agent/services/agent/agentAuth'),
  () => ({ agentSettingsAuthHeader: accountApi.header })
)

const stored: GlobalSetting = {
  key: 'Comfy.AgentPanel.ConsentAccepted',
  value: true,
  updated_at: '2026-09-09T00:00:00Z'
}

const billingContext = useBillingContext()

describe('useAgentDockMount consent handoff', () => {
  const fetchStatus = vi.fn(async () => {})

  beforeEach(() => {
    useCurrentUser().resolvedUserInfo = computed(() => ({ id: 'account-a' }))
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'workspace-a',
      workspaceTransitionGeneration: 0
    })
    useTeamWorkspaceStore().isSwitching = false
    vi.mocked(useTeamWorkspaceStore().initialize).mockResolvedValue(undefined)
    accountApi.header.mockResolvedValue({ Authorization: 'Bearer token' })
    accountApi.get.mockResolvedValue(undefined)
    accountApi.set.mockResolvedValue(stored)
    fetchStatus.mockClear()
    vi.mocked(useBillingContext).mockReturnValue({
      ...billingContext,
      fetchStatus
    })
  })

  it('refreshes billing from the persistent host after a confirmed Agree', async () => {
    let finishSave = (_value: GlobalSetting): void => {}
    accountApi.set.mockImplementationOnce(
      () =>
        new Promise<GlobalSetting>((resolve) => {
          finishSave = resolve
        })
    )
    useAgentDockMount()

    const accepting = useAgentConsentStore().accept()
    await vi.waitFor(() => expect(accountApi.set).toHaveBeenCalledOnce())
    expect(fetchStatus).not.toHaveBeenCalled()

    finishSave(stored)
    await expect(accepting).resolves.toBe(true)

    expect(fetchStatus).toHaveBeenCalledOnce()
  })

  it('does not refresh billing when stored consent loads', async () => {
    accountApi.get.mockResolvedValue(stored)
    useAgentDockMount()

    await expect(useAgentConsentStore().load()).resolves.toBe(true)

    expect(fetchStatus).not.toHaveBeenCalled()
  })
})
