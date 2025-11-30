import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/composables/auth/useFirebaseAuthActions', () => ({
  useFirebaseAuthActions: () => ({
    purchaseCredits: vi.fn(),
    fetchBalance: vi.fn(),
    accessBillingPortal: vi.fn()
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackApiCreditTopupButtonPurchaseClicked: vi.fn()
  })
}))

import CreditTopUpOption from '@/components/dialog/content/credit/CreditTopUpOption.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { credits: { credits: 'Credits' } } }
})

const mountOption = (
  props?: Partial<{ amount: number; preselected: boolean; editable: boolean }>
) =>
  mount(CreditTopUpOption, {
    props: {
      amount: 10,
      preselected: false,
      editable: false,
      ...props
    },
    global: {
      plugins: [i18n],
      stubs: {
        Tag: { template: '<span><slot /></span>' },
        Button: { template: '<button><slot /></button>' },
        InputNumber: {
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template:
            '<input type="number" :value="modelValue" @input="$emit(\'update:modelValue\',$event.target.value)" />'
        },
        ProgressSpinner: { template: '<div class="spinner" />' }
      }
    }
  })

describe('CreditTopUpOption', () => {
  it('renders converted credit price for preset amounts', () => {
    const wrapper = mountOption({ amount: 2.1 })
    expect(wrapper.text()).toContain('1.00 Credits')
    expect(wrapper.text()).toContain('$2.10')
  })

  it('updates credit label when editable amount changes', async () => {
    const wrapper = mountOption({ editable: true })
    const vm = wrapper.vm as unknown as { customAmount: number }
    vm.customAmount = 4.2
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('2.00 Credits')
  })
})
