import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import ComfyHubProfilePromptPanel from './ComfyHubProfilePromptPanel.vue'

function renderProfilePrompt() {
  return render(ComfyHubProfilePromptPanel, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        Button: {
          emits: ['click'],
          template: '<button @click="$emit(\'click\')"><slot /></button>'
        }
      }
    }
  })
}

describe('ComfyHubProfilePromptPanel', () => {
  it('emits a profile request from the create profile CTA', async () => {
    const user = userEvent.setup()
    const { emitted } = renderProfilePrompt()

    await user.click(screen.getByText('comfyHubPublish.createProfileCta'))

    expect(
      screen.getByText('comfyHubPublish.createProfileToPublish')
    ).toBeTruthy()
    expect(emitted().requestProfile).toHaveLength(1)
  })
})
