import { describe, expect, it, vi } from 'vitest'

const mockIsCloud = vi.hoisted(() => ({ value: true }))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

const mockShowLayoutDialog = vi.fn()
vi.mock('@/services/dialogService', () => ({
  useDialogService: vi.fn(() => ({
    showLayoutDialog: mockShowLayoutDialog
  }))
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: vi.fn(() => ({
    closeDialog: vi.fn()
  }))
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: vi.fn(() => ({
    flags: { teamWorkspacesEnabled: false }
  }))
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: vi.fn(() => ({
    isFreeTier: { value: false }
  }))
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: vi.fn(() => ({
    isInPersonalWorkspace: true
  }))
}))

vi.mock('pinia')

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApp: vi.fn()
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  setPersistence: vi.fn(),
  browserLocalPersistence: {},
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn()
}))

describe('useSubscriptionDialog', () => {
  it('showPricingTable does not open dialog on non-cloud', async () => {
    mockIsCloud.value = false
    const { useSubscriptionDialog } = await import('./useSubscriptionDialog')
    const dialog = useSubscriptionDialog()

    dialog.showPricingTable()

    expect(mockShowLayoutDialog).not.toHaveBeenCalled()
  })

  it('showPricingTable opens dialog on cloud', async () => {
    mockIsCloud.value = true
    const { useSubscriptionDialog } = await import('./useSubscriptionDialog')
    const dialog = useSubscriptionDialog()

    dialog.showPricingTable()

    expect(mockShowLayoutDialog).toHaveBeenCalled()
  })
})
