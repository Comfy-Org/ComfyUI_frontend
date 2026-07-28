import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import GlobalToast from './GlobalToast.vue'

const hostedInvoiceUrl = ref<string | null>(null)

vi.mock('@/platform/workspace/stores/billingOperationStore', () => ({
  useBillingOperationStore: () => ({
    get hostedInvoiceUrl() {
      return hostedInvoiceUrl.value
    }
  })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: vi.fn() })
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({
    messagesToAdd: [],
    messagesToRemove: [],
    removeAllRequested: false
  })
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: vi.fn(),
    remove: vi.fn(),
    removeAllGroups: vi.fn()
  })
}))

const ToastStub = {
  props: ['group'],
  template: `
    <div v-if="group === 'billing-operation'">
      <slot name="message" :message="{ summary: 'Processing payment' }" />
    </div>
  `
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      billingOperation: {
        continueToPayment: 'Continue to payment'
      }
    }
  }
})

describe('GlobalToast hosted invoice action', () => {
  beforeEach(() => {
    hostedInvoiceUrl.value = null
  })

  it('renders an explicit new-tab payment link when the operation exposes one', async () => {
    const { rerender } = render(GlobalToast, {
      global: {
        plugins: [i18n],
        stubs: { Toast: ToastStub }
      }
    })

    expect(
      screen.queryByRole('link', { name: 'Continue to payment' })
    ).not.toBeInTheDocument()

    hostedInvoiceUrl.value = 'https://invoice.test/bearer-token'
    await rerender({})

    expect(
      screen.getByRole('link', { name: 'Continue to payment' })
    ).toHaveAttribute('href', 'https://invoice.test/bearer-token')
    expect(
      screen.getByRole('link', { name: 'Continue to payment' })
    ).toHaveAttribute('target', '_blank')
    expect(
      screen.getByRole('link', { name: 'Continue to payment' })
    ).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
