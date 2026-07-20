import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import ComfyHubPublishFooter from './ComfyHubPublishFooter.vue'

function renderFooter(props: Record<string, unknown> = {}) {
  return render(ComfyHubPublishFooter, {
    props: { isFirstStep: false, isLastStep: true, ...props },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        Button: {
          props: ['disabled', 'loading'],
          emits: ['click'],
          template:
            '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>'
        }
      }
    }
  })
}

describe('ComfyHubPublishFooter', () => {
  it('shows the publish label for a new workflow', () => {
    renderFooter({ isUpdate: false })
    expect(screen.getByText('comfyHubPublish.publishButton')).toBeTruthy()
  })

  it('shows the update label when the workflow is already published', () => {
    renderFooter({ isUpdate: true })
    expect(screen.getByText('comfyHubPublish.updateButton')).toBeTruthy()
  })

  it('shows only the next action on the first non-final step', () => {
    renderFooter({ isFirstStep: true, isLastStep: false })

    expect(screen.queryByText('comfyHubPublish.back')).toBeNull()
    expect(screen.getByText('comfyHubPublish.next')).toBeTruthy()
  })

  it('emits back and next from middle steps', async () => {
    const user = userEvent.setup()
    const { emitted } = renderFooter({ isFirstStep: false, isLastStep: false })

    await user.click(screen.getByText('comfyHubPublish.back'))
    await user.click(screen.getByText('comfyHubPublish.next'))

    expect(emitted().back).toHaveLength(1)
    expect(emitted().next).toHaveLength(1)
  })

  it('disables publish while publishing', () => {
    renderFooter({ isPublishDisabled: false, isPublishing: true })

    expect(screen.getByText('comfyHubPublish.publishButton')).toBeDisabled()
  })
})
