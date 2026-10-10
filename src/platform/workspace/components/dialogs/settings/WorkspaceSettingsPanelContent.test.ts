import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, onMounted, onUnmounted } from 'vue'

import { createI18n } from 'vue-i18n'

import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import WorkspaceSettingsPanelContent from './WorkspaceSettingsPanelContent.vue'

const { mockBannerMounted, mockBannerUnmounted } = vi.hoisted(() => ({
  mockBannerMounted: vi.fn(),
  mockBannerUnmounted: vi.fn()
}))

vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))
vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/composables/billing/useBillingContext'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/services/dialogService'))
vi.mock(
  import('@/platform/cloud/subscription/composables/useSubscriptionDialog')
)
vi.mock<unknown>(
  import('primevue/usetoast'), // oxlint-disable-line comfy/no-primevue-imports
  () => ({
    useToast: () => ({ add: vi.fn() })
  })
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

const BillingStatusBanner = defineComponent({
  setup() {
    onMounted(mockBannerMounted)
    onUnmounted(mockBannerUnmounted)
    return () => h('div', { 'data-testid': 'billing-banner' })
  }
})

const stubs = {
  BillingStatusBanner,
  MembersPanelContent: { template: '<div data-testid="members-body" />' },
  PartnerNodeAccessPanel: { template: '<div data-testid="allowlist-body" />' },
  PlanCreditsPanelContent: { template: '<div data-testid="plan-body" />' }
}

beforeEach(() => {
  useBillingCapabilities().canManageMembers = computed(() => true)
  const workspaceUI = vi.mocked(useWorkspaceUI())
  workspaceUI.workspaceRole = computed(() => 'owner')
  const ownerPermissions = workspaceUI.permissions.value
  workspaceUI.permissions = computed(() => ({
    ...ownerPermissions,
    canViewPendingInvites: true
  }))
  Object.assign(useTeamWorkspaceStore(), { workspaceName: 'Acme Team' })
  vi.mocked(useTeamWorkspaceStore().fetchMembers).mockResolvedValue([])
  vi.mocked(useTeamWorkspaceStore().fetchPendingInvites).mockResolvedValue([])
})

describe('WorkspaceSettingsPanelContent', () => {
  beforeEach(() => {
    vi.mocked(useTeamWorkspaceStore().fetchMembers).mockResolvedValue([])
    vi.mocked(useTeamWorkspaceStore().fetchPendingInvites).mockResolvedValue([])
  })

  it('keeps the billing banner mounted while switching sections', async () => {
    const { rerender, unmount } = render(WorkspaceSettingsPanelContent, {
      props: { section: 'planCredits' },
      global: { stubs, plugins: [i18n] }
    })

    expect(screen.getByTestId('plan-body')).toBeInTheDocument()
    expect(screen.queryByTestId('members-body')).not.toBeInTheDocument()
    expect(mockBannerMounted).toHaveBeenCalledTimes(1)
    expect(mockBannerUnmounted).not.toHaveBeenCalled()

    await rerender({ section: 'members' })

    expect(screen.queryByTestId('plan-body')).not.toBeInTheDocument()
    expect(screen.getByTestId('members-body')).toBeInTheDocument()
    expect(useTeamWorkspaceStore().fetchMembers).toHaveBeenCalledTimes(1)
    expect(useTeamWorkspaceStore().fetchPendingInvites).toHaveBeenCalledTimes(1)
    expect(mockBannerMounted).toHaveBeenCalledTimes(1)
    expect(mockBannerUnmounted).not.toHaveBeenCalled()

    await rerender({ section: 'allowlist' })

    expect(screen.queryByTestId('members-body')).not.toBeInTheDocument()
    expect(screen.getByTestId('allowlist-body')).toBeInTheDocument()
    expect(useTeamWorkspaceStore().fetchMembers).toHaveBeenCalledTimes(1)
    expect(useTeamWorkspaceStore().fetchPendingInvites).toHaveBeenCalledTimes(1)
    expect(mockBannerMounted).toHaveBeenCalledTimes(1)
    expect(mockBannerUnmounted).not.toHaveBeenCalled()

    unmount()
    expect(mockBannerUnmounted).toHaveBeenCalledTimes(1)
  })
})
