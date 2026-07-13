import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import BillingStatusBanner from './BillingStatusBanner.vue'

const mockManageSubscription = vi.fn()
const mockBillingStatus = ref<'payment_failed' | null>(null)
const mockIsPaused = ref(true)
const mockCanManageSubscription = ref(true)

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    billingStatus: mockBillingStatus,
    isPaused: mockIsPaused,
    isActiveSubscription: ref(true),
    subscription: ref({ hasFunds: true, isCancelled: false }),
    renewalDate: ref(null),
    manageSubscription: mockManageSubscription
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: ref({
      canManageSubscription: mockCanManageSubscription.value
    }),
    isInPersonalWorkspace: ref(false)
  })
}))

vi.mock('@/platform/workspace/composables/useResubscribe', () => ({
  useResubscribe: () => ({
    isResubscribing: ref(false),
    handleResubscribe: vi.fn()
  })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ showTopUpCreditsDialog: vi.fn() })
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
    mockBillingStatus.value = null
    mockIsPaused.value = true
    mockCanManageSubscription.value = true
  })

  it('opens subscription management from the payment action', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Update payment' }))

    expect(mockManageSubscription).toHaveBeenCalledOnce()
  })
})
