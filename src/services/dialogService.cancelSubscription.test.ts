import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
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
    type: { value: 'legacy' }
  })
}))

vi.mock('@/platform/cloud/subscription/launchCancellationFlow', () => {
  throw new Error('chunk failed to load')
})

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

describe('showCancelSubscriptionFlow', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.activeWorkspaceId = 'workspace-1'
  })

  it('falls back to the native dialog when its module fails to load', async () => {
    await useDialogService().showCancelSubscriptionFlow(
      '2026-08-01T00:00:00Z',
      'workspace-1'
    )

    expect(mocks.showDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'cancel-subscription',
        props: {
          cancelAt: '2026-08-01T00:00:00Z',
          flowAlreadyOpened: false,
          expectedWorkspaceId: 'workspace-1'
        }
      })
    )
  })

  it('does not open the fallback after the workspace changes', async () => {
    const flow = useDialogService().showCancelSubscriptionFlow(
      '2026-08-01T00:00:00Z',
      'workspace-1'
    )
    mocks.activeWorkspaceId = 'workspace-2'

    await flow

    expect(mocks.showDialog).not.toHaveBeenCalled()
  })
})
