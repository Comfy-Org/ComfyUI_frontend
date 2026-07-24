import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, inject, provide, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import PricingTableWorkspace from './PricingTableWorkspace.vue'

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    plans: ref([]),
    currentPlanSlug: ref(null),
    fetchPlans: vi.fn(),
    subscription: ref(null),
    getMaxSeats: () => 1
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const popoverOpenKey = Symbol('popoverOpen')

const PopoverStub = defineComponent({
  setup(_, { slots }) {
    provide(popoverOpenKey, ref(false))
    return () => h('div', slots.default?.())
  }
})

const PopoverTriggerStub = defineComponent({
  setup(_, { slots }) {
    const isOpen = inject(popoverOpenKey, ref(false))
    return () =>
      h(
        'div',
        {
          onClick: () => {
            isOpen.value = !isOpen.value
          }
        },
        slots.default?.()
      )
  }
})

const PopoverContentStub = defineComponent({
  setup(_, { slots }) {
    const isOpen = inject(popoverOpenKey, ref(false))
    return () => (isOpen.value ? h('div', slots.default?.()) : null)
  }
})

function renderComponent() {
  return render(PricingTableWorkspace, {
    global: {
      plugins: [i18n],
      stubs: {
        SelectButton: { template: '<div />' },
        Popover: PopoverStub,
        PopoverTrigger: PopoverTriggerStub,
        PopoverContent: PopoverContentStub
      }
    }
  })
}

describe('PricingTableWorkspace', () => {
  it('opens the video estimate help popover from its trigger', async () => {
    const user = userEvent.setup()
    renderComponent()

    expect(
      screen.queryByText(
        'These estimates are based on the Wan 2.2 Image-to-Video template using default settings (5 sec, 16fps, 640x640, 4-step sampling).'
      )
    ).not.toBeInTheDocument()

    await user.click(
      screen.getAllByRole('button', {
        name: 'More details on this template'
      })[0]
    )

    expect(
      await screen.findByText(
        'These estimates are based on the Wan 2.2 Image-to-Video template using default settings (5 sec, 16fps, 640x640, 4-step sampling).'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Try this template' })
    ).toHaveAttribute(
      'href',
      'https://cloud.comfy.org/?template=video_wan2_2_14B_i2v'
    )
  })
})
