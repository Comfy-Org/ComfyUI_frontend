import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import enMessages from '@/locales/en/main.json'
import PricingTableWorkspace from '@/platform/workspace/components/PricingTableWorkspace.vue'

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    plans: ref([]),
    currentPlanSlug: computed(() => null),
    fetchPlans: vi.fn(),
    subscription: computed(() => null),
    getMaxSeats: () => 5
  })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({ execute: vi.fn() })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const cycleToggleStub = {
  props: ['options'],
  emits: ['update:modelValue'],
  template: `<div><button
      v-for="option in options"
      :key="option.value"
      :data-testid="'cycle-' + option.value"
      @click="$emit('update:modelValue', option.value)"
    >{{ option.label }}</button></div>`
}

function renderComponent() {
  return render(PricingTableWorkspace, {
    global: {
      plugins: [i18n],
      components: { Button },
      stubs: {
        SelectButton: cycleToggleStub,
        Popover: { template: '<div><slot /></div>' }
      }
    }
  })
}

describe('PricingTableWorkspace credit allotment copy', () => {
  it('states the whole-year per-member allotment on the yearly cycle', () => {
    renderComponent()

    expect(screen.getAllByText('Yearly credits / member')).toHaveLength(3)
    expect(screen.queryAllByText('Monthly credits / member')).toHaveLength(0)
    expect(screen.getByText('50,400')).toBeTruthy()
    expect(screen.getByText('~4,560')).toBeTruthy()
  })

  it('states the monthly per-member allotment on the monthly cycle', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByTestId('cycle-monthly'))
    await nextTick()

    expect(screen.getAllByText('Monthly credits / member')).toHaveLength(3)
    expect(screen.queryAllByText('Yearly credits / member')).toHaveLength(0)
    expect(screen.getByText('4,200')).toBeTruthy()
    expect(screen.getByText('~380')).toBeTruthy()
  })
})
