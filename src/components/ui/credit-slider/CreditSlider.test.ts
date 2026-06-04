import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { usdToCredits } from '@/base/credits/comfyCredits'
import { TEAM_PLAN_CREDIT_STOPS } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'

import CreditSlider from './CreditSlider.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      subscription: { perMonth: '/ month' },
      credits: { credits: 'Credits' }
    }
  }
})

function renderSlider(props: Record<string, unknown> = {}) {
  return render(CreditSlider, { props, global: { plugins: [i18n] } })
}

async function flush() {
  await nextTick()
  await nextTick()
}

describe('CreditSlider', () => {
  it('defaults to the $700 stop (index 2) when no value is bound', async () => {
    renderSlider()
    await flush()

    const thumb = screen.getByRole('slider')
    expect(thumb).toHaveAttribute('aria-valuemin', '0')
    expect(thumb).toHaveAttribute('aria-valuemax', '4')
    expect(thumb).toHaveAttribute('aria-valuenow', '2')
  })

  it('snaps to the next fixed stop on ArrowRight (never a value in between)', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn<(usd: number) => void>()

    renderSlider({ modelValue: 700, 'onUpdate:modelValue': onUpdate })
    await flush()

    screen.getByRole('slider').focus()
    await user.keyboard('{ArrowRight}')

    expect(onUpdate).toHaveBeenCalledWith(1400)
  })

  it('snaps to the previous fixed stop on ArrowLeft', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn<(usd: number) => void>()

    renderSlider({ modelValue: 700, 'onUpdate:modelValue': onUpdate })
    await flush()

    screen.getByRole('slider').focus()
    await user.keyboard('{ArrowLeft}')

    expect(onUpdate).toHaveBeenCalledWith(400)
  })

  it('emits change with the full {index, usd, credits} payload', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    renderSlider({ modelValue: 700, onChange })
    await flush()

    screen.getByRole('slider').focus()
    await user.keyboard('{ArrowRight}')

    expect(onChange).toHaveBeenCalledWith({
      index: 3,
      usd: 1400,
      credits: 295_400
    })
  })

  it('renders all five fixed USD stop labels', async () => {
    renderSlider({ modelValue: 700 })
    await flush()

    const stops = within(screen.getByTestId('credit-slider-stops'))
    for (const label of ['$200', '$400', '$700', '$1,400', '$2,500']) {
      expect(stops.getByText(label)).toBeInTheDocument()
    }
  })

  it('keeps every credit amount equal to usdToCredits(usd) (guards rate drift)', () => {
    for (const stop of TEAM_PLAN_CREDIT_STOPS) {
      expect(stop.credits).toBe(usdToCredits(stop.usd))
    }
  })
})
