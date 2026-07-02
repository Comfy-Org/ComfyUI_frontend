import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import ComfyHubPublishIntroPanel from './ComfyHubPublishIntroPanel.vue'

vi.mock('@/components/ui/button/Button.vue', () => ({
  default: {
    props: ['ariaLabel'],
    emits: ['click'],
    template: `
      <button type="button" :aria-label="ariaLabel" @click="$emit('click')">
        <slot />
      </button>
    `
  }
}))

function renderPanel(
  props: Partial<InstanceType<typeof ComfyHubPublishIntroPanel>['$props']> = {}
) {
  return render(ComfyHubPublishIntroPanel, {
    props: {
      onCreateProfile: vi.fn(),
      onClose: vi.fn(),
      ...props
    },
    global: {
      config: {
        globalProperties: {
          $t: (key: string) => key
        }
      }
    }
  })
}

describe('ComfyHubPublishIntroPanel', () => {
  it('renders the publish intro and handles close and create actions', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onCreateProfile = vi.fn()
    renderPanel({ onClose, onCreateProfile })

    expect(screen.getByText('comfyHubProfile.introTitle')).toBeInTheDocument()
    expect(
      screen.getByText('comfyHubProfile.introDescription')
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'g.close' }))
    await user.click(
      screen.getByRole('button', {
        name: 'comfyHubProfile.startPublishingButton'
      })
    )

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onCreateProfile).toHaveBeenCalledTimes(1)
  })

  it('renders the update variant without the close button', () => {
    renderPanel({ showCloseButton: false, isUpdate: true })

    expect(
      screen.queryByRole('button', { name: 'g.close' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('comfyHubProfile.updateIntroTitle')
    ).toBeInTheDocument()
    expect(
      screen.getByText('comfyHubProfile.updateIntroDescription')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'comfyHubProfile.startUpdatingButton'
      })
    ).toBeInTheDocument()
  })
})
