import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import WorkspacePanelContent from './WorkspacePanelContent.vue'

const mockFetchMembers = vi.fn()
const mockFetchPendingInvites = vi.fn()

const { mockHasTeamPlan, mockIsPlanLoading } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')

  return {
    mockHasTeamPlan: ref(true),
    mockIsPlanLoading: ref(false)
  }
})

vi.mock('@/platform/workspace/composables/useTeamPlan', () => ({
  useTeamPlan: () => ({
    hasTeamPlan: mockHasTeamPlan,
    isPlanLoading: mockIsPlanLoading
  })
}))

vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    storeToRefs: (store: Record<string, unknown>) => store
  }
})

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')
  return {
    useTeamWorkspaceStore: () => ({
      workspaceName: ref('Acme Team'),
      fetchMembers: mockFetchMembers,
      fetchPendingInvites: mockFetchPendingInvites
    })
  }
})

vi.mock(
  '@/platform/workspace/components/SubscriptionPanelContentWorkspace.vue',
  () => ({
    default: {
      name: 'SubscriptionPanelContentWorkspace',
      template: '<div data-testid="plan-panel" />'
    }
  })
)

vi.mock(
  '@/platform/workspace/components/dialogs/settings/MembersPanelContent.vue',
  () => ({
    default: {
      name: 'MembersPanelContent',
      template: '<div data-testid="members-panel" />'
    }
  })
)

vi.mock(
  '@/platform/workspace/components/dialogs/settings/PartnerNodeAccessPanel.vue',
  () => ({
    default: {
      name: 'PartnerNodeAccessPanel',
      template: '<div data-testid="allowlist-panel" />'
    }
  })
)

vi.mock(
  '@/platform/workspace/components/dialogs/settings/BillingStatusBanner.vue',
  () => ({
    default: {
      name: 'BillingStatusBanner',
      template: '<div data-testid="billing-banner" />'
    }
  })
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

function renderComponent(section: 'plan' | 'members' | 'allowlist' = 'plan') {
  return render(WorkspacePanelContent, {
    props: { section },
    global: {
      plugins: [i18n],
      stubs: { WorkspaceProfilePic: true }
    }
  })
}

describe('WorkspacePanelContent billing banner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hosts a single banner slot above the selected workspace section', () => {
    renderComponent()

    const banner = screen.getByTestId('billing-banner')
    const planPanel = screen.getByTestId('plan-panel')
    expect(
      banner.compareDocumentPosition(planPanel) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })
})

describe('WorkspacePanelContent member loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasTeamPlan.value = true
    mockIsPlanLoading.value = false
  })

  it('fetches members and pending invites for a Team plan', () => {
    renderComponent()
    expect(mockFetchMembers).toHaveBeenCalled()
    expect(mockFetchPendingInvites).toHaveBeenCalled()
  })

  it('does not fetch member data for a personal plan', () => {
    mockHasTeamPlan.value = false
    renderComponent()
    expect(mockFetchMembers).not.toHaveBeenCalled()
    expect(mockFetchPendingInvites).not.toHaveBeenCalled()
  })

  it('waits for billing initialization before fetching member data', () => {
    mockIsPlanLoading.value = true
    renderComponent()
    expect(mockFetchMembers).not.toHaveBeenCalled()
    expect(mockFetchPendingInvites).not.toHaveBeenCalled()
  })
})

describe('WorkspacePanelContent sections', () => {
  it('renders Plan & Credits without internal workspace tabs', () => {
    renderComponent()

    expect(screen.getByTestId('plan-panel')).toBeTruthy()
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it('renders Members as a separate panel', () => {
    renderComponent('members')

    expect(screen.getByTestId('members-panel')).toBeTruthy()
    expect(screen.queryByTestId('plan-panel')).toBeNull()
  })

  it('renders Allowlist as a separate panel', () => {
    renderComponent('allowlist')

    expect(screen.getByTestId('allowlist-panel')).toBeTruthy()
    expect(screen.queryByTestId('plan-panel')).toBeNull()
  })
})
