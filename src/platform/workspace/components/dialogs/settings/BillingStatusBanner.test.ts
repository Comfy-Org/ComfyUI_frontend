import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import BillingStatusBanner from './BillingStatusBanner.vue'

const mockManageSubscription = vi.fn()
const mockShowTopUpCreditsDialog = vi.fn()
const mockHandleResubscribe = vi.fn()
const mockBillingStatus = ref<'payment_failed' | null>(null)
const mockIsPaused = ref(true)
const mockIsActiveSubscription = ref(true)
const mockSubscription = ref<{
  hasFunds: boolean
  isCancelled: boolean
  endDate?: string
}>({ hasFunds: true, isCancelled: false })
const mockRenewalDate = ref<string | null>(null)
const mockPermissions = ref({ canManageSubscription: true })
const mockIsInPersonalWorkspace = ref(false)
let mockActiveWorkspaceId: string | null = 'team-1'

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    billingStatus: mockBillingStatus,
    isPaused: mockIsPaused,
    isActiveSubscription: mockIsActiveSubscription,
    subscription: mockSubscription,
    renewalDate: mockRenewalDate,
    manageSubscription: mockManageSubscription
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: mockPermissions,
    isInPersonalWorkspace: mockIsInPersonalWorkspace
  })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    activeWorkspaceId: mockActiveWorkspaceId
  })
}))

vi.mock('@/platform/workspace/composables/useResubscribe', () => ({
  useResubscribe: () => ({
    isResubscribing: ref(false),
    handleResubscribe: mockHandleResubscribe
  })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showTopUpCreditsDialog: mockShowTopUpCreditsDialog
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderComponent() {
  return render(BillingStatusBanner, { global: { plugins: [i18n] } })
}

describe('BillingStatusBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mockBillingStatus.value = null
    mockIsPaused.value = true
    mockIsActiveSubscription.value = true
    mockSubscription.value = { hasFunds: true, isCancelled: false }
    mockRenewalDate.value = null
    mockPermissions.value = { canManageSubscription: true }
    mockIsInPersonalWorkspace.value = false
    mockActiveWorkspaceId = 'team-1'
  })

  it('prioritizes a paused subscription and opens payment management', async () => {
    const user = userEvent.setup()
    mockBillingStatus.value = 'payment_failed'
    renderComponent()

    expect(screen.getByText('Subscription paused')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Update payment' }))

    expect(mockManageSubscription).toHaveBeenCalledOnce()
  })

  it('shows paused members non-actionable guidance', () => {
    mockPermissions.value = { canManageSubscription: false }

    renderComponent()

    expect(
      screen.getByText(
        "This workspace's subscription is paused. Your workspace admins need to update the payment method."
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('opens payment management for a failed payment', async () => {
    const user = userEvent.setup()
    mockIsPaused.value = false
    mockBillingStatus.value = 'payment_failed'
    mockRenewalDate.value = '2026-08-15T00:00:00Z'
    renderComponent()

    expect(screen.getByText('Payment declined')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Update payment' }))

    expect(mockManageSubscription).toHaveBeenCalledOnce()
  })

  it('opens top-up and dismisses an out-of-credits banner', async () => {
    const user = userEvent.setup()
    mockIsPaused.value = false
    mockSubscription.value = { hasFunds: false, isCancelled: false }
    mockRenewalDate.value = '2026-08-15T00:00:00Z'
    const { unmount } = renderComponent()

    expect(screen.getByText('Out of credits')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add credits' }))
    expect(mockShowTopUpCreditsDialog).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    unmount()
    renderComponent()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('reactivates a plan that is ending', async () => {
    const user = userEvent.setup()
    mockIsPaused.value = false
    mockSubscription.value = {
      hasFunds: true,
      isCancelled: true,
      endDate: '2026-08-31T00:00:00Z'
    }
    renderComponent()

    expect(screen.getByText(/Your team plan ends on/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reactivate plan' }))

    expect(mockHandleResubscribe).toHaveBeenCalledOnce()
  })

  it('hides billing banners in personal workspaces', () => {
    mockIsInPersonalWorkspace.value = true

    renderComponent()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
