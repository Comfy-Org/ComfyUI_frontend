import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ComfyHubPublishNav from './ComfyHubPublishNav.vue'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

vi.mock('@formkit/auto-animate/vue', () => ({
  vAutoAnimate: {}
}))

vi.mock('@/components/ui/button/Button.vue', () => ({
  default: {
    emits: ['click'],
    template: `
      <button type="button" v-bind="$attrs" @click="$emit('click')">
        <slot />
      </button>
    `
  }
}))

vi.mock('@/components/common/StatusBadge.vue', () => ({
  default: {
    props: ['label'],
    template:
      '<span data-testid="step-badge" v-bind="$attrs">{{ label }}</span>'
  }
}))

describe('ComfyHubPublishNav', () => {
  it('marks current and completed steps and emits clicked steps', async () => {
    const user = userEvent.setup()
    const { emitted } = render(ComfyHubPublishNav, {
      props: {
        currentStep: 'examples'
      },
      global: {
        plugins: [i18n]
      }
    })

    const nav = screen.getByTestId('publish-nav')
    expect(
      within(nav).getByText('comfyHubPublish.stepExamples')
    ).toBeInTheDocument()
    const currentStepItem = screen.getByRole('listitem', { current: 'step' })
    expect(currentStepItem).toHaveTextContent('comfyHubPublish.stepExamples')
    expect(currentStepItem).toHaveAttribute('aria-current', 'step')

    await user.click(screen.getByText('comfyHubPublish.stepFinish'))

    expect(emitted('stepClick')).toEqual([['finish']])
  })

  it('renders the profile creation sub-step as part of the finish step', () => {
    render(ComfyHubPublishNav, {
      props: {
        currentStep: 'profileCreation'
      },
      global: {
        plugins: [i18n]
      }
    })

    expect(
      screen.getByText('comfyHubProfile.profileCreationNav')
    ).toBeInTheDocument()
    const finishStep = screen.getAllByRole('listitem')[2]
    expect(finishStep).not.toHaveAttribute('aria-current')
  })
})
