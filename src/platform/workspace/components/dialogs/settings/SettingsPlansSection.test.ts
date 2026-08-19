import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'

import enMessages from '@/locales/en/main.json'

import SettingsPlansSection from './SettingsPlansSection.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderSection() {
  return render(SettingsPlansSection, {
    global: {
      plugins: [i18n],
      stubs: {
        // Clicking moves the v-model selection to the $200 stop so tests can
        // drive the team credits display.
        CreditSlider: {
          template:
            '<button data-testid="team-slider" @click="$emit(\'update:modelValue\', 200)" />',
          emits: ['update:modelValue']
        }
      }
    }
  })
}

describe('SettingsPlansSection', () => {
  it('renders the three personal cards with yearly pricing by default', () => {
    renderSection()

    expect(screen.getByText('Standard')).toBeTruthy()
    expect(screen.getByText('Creator')).toBeTruthy()
    expect(screen.getByText('Pro')).toBeTruthy()

    expect(screen.getByText('$16')).toBeTruthy()
    expect(screen.getByText('$28')).toBeTruthy()
    expect(screen.getByText('$80')).toBeTruthy()

    expect(screen.getByText('$192 Billed yearly')).toBeTruthy()
    expect(screen.getByText('$336 Billed yearly')).toBeTruthy()
    expect(screen.getByText('$960 Billed yearly')).toBeTruthy()

    expect(screen.getByText('50,400')).toBeTruthy()
    expect(screen.getAllByText('credits a year')).toHaveLength(3)

    expect(screen.getByText('263 per dollar')).toBeTruthy()
    expect(screen.getAllByText('264 per dollar')).toHaveLength(2)

    expect(screen.getByText("What's included:")).toBeTruthy()
    expect(screen.getByText('Everything in Standard, plus:')).toBeTruthy()
    expect(screen.getByText('Everything in Creator, plus:')).toBeTruthy()
  })

  it('switches to monthly pricing without any savings copy on the cards', async () => {
    renderSection()

    await userEvent.click(screen.getByRole('switch'))

    expect(screen.getByText('$20')).toBeTruthy()
    expect(screen.getByText('$35')).toBeTruthy()
    expect(screen.getByText('$100')).toBeTruthy()

    expect(screen.getAllByText('Billed monthly')).toHaveLength(3)
    expect(screen.queryByText(/\$\d+ Billed yearly/)).toBeNull()

    expect(screen.getByText('4,200')).toBeTruthy()
    expect(screen.getAllByText('credits a month')).toHaveLength(3)

    expect(screen.getByText('210 per dollar')).toBeTruthy()
    expect(screen.getAllByText('211 per dollar')).toHaveLength(2)
  })

  it('shows the team plan with the default credit stop on the Teams tab', async () => {
    renderSection()

    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))

    expect(screen.queryByText('Choose Standard')).toBeNull()
    expect(screen.getByText('Team Plan')).toBeTruthy()
    expect(screen.getByText('147,700')).toBeTruthy()
    expect(screen.getByText('Generates ~13,405 5s videos*')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Subscribe to Team Yearly' })
    ).toBeTruthy()
    expect(screen.getByText('Enterprise')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Contact us' })).toBeTruthy()
  })

  it('drives the team credits and video estimate from the slider selection', async () => {
    renderSection()

    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))
    await userEvent.click(screen.getByTestId('team-slider'))

    expect(screen.getByText('42,200')).toBeTruthy()
    expect(screen.getByText('Generates ~3,830 5s videos*')).toBeTruthy()
  })

  it('labels the team subscribe button for the monthly cycle', async () => {
    renderSection()

    await userEvent.click(screen.getByRole('switch'))
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))

    expect(
      screen.getByRole('button', { name: 'Subscribe to Team Monthly' })
    ).toBeTruthy()
  })
})
