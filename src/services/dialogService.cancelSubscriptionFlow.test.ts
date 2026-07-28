import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  launchCancellationFlow: vi.fn(),
  showDialog: vi.fn(),
  activeWorkspaceId: 'workspace-1'
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog: mocks.showDialog })
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackEvent: vi.fn() })
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: { value: true },
    isFreeTier: { value: false },
    type: { value: 'workspace' }
  })
}))

vi.mock('@/platform/cloud/subscription/launchCancellationFlow', () => ({
  launchCancellationFlow: mocks.launchCancellationFlow
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    get activeWorkspaceId() {
      return mocks.activeWorkspaceId
    }
  })
}))

vi.mock(
  '@/components/dialog/content/subscription/CancelSubscriptionDialogContent.vue',
  () => ({ default: { name: 'CancelSubscriptionDialogContent' } })
)

import { useDialogService } from '@/services/dialogService'

describe('showCancelSubscriptionFlow delegation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.activeWorkspaceId = 'workspace-1'
  })

  it('passes cancelAt and a working native fallback to the orchestrator', async () => {
    mocks.launchCancellationFlow.mockImplementation(
      async ({ cancelAt, workspaceId, showFallback }) => {
        expect(cancelAt).toBe('2026-08-01T00:00:00Z')
        expect(workspaceId).toBe('workspace-1')
        await showFallback({ flowAlreadyOpened: true })
      }
    )

    await useDialogService().showCancelSubscriptionFlow(
      '2026-08-01T00:00:00Z',
      'workspace-1'
    )

    expect(mocks.launchCancellationFlow).toHaveBeenCalledOnce()
    expect(mocks.showDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'cancel-subscription',
        props: {
          cancelAt: '2026-08-01T00:00:00Z',
          flowAlreadyOpened: true,
          expectedWorkspaceId: 'workspace-1'
        }
      })
    )
  })

  it('does not launch after the workspace changes during module loading', async () => {
    const flow = useDialogService().showCancelSubscriptionFlow(
      '2026-08-01T00:00:00Z',
      'workspace-1'
    )
    mocks.activeWorkspaceId = 'workspace-2'

    await flow

    expect(mocks.launchCancellationFlow).not.toHaveBeenCalled()
    expect(mocks.showDialog).not.toHaveBeenCalled()
  })
})
