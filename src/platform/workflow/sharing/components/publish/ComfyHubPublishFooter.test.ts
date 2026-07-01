import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ComfyHubPublishFooter from './ComfyHubPublishFooter.vue'

function renderFooter(props: Record<string, unknown> = {}) {
  return render(ComfyHubPublishFooter, {
    props: { isFirstStep: false, isLastStep: true, ...props },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        Button: {
          template: '<button><slot /></button>'
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
})
