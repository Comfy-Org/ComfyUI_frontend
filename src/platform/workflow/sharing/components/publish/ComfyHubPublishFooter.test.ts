import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import ComfyHubPublishFooter from './ComfyHubPublishFooter.vue'

function renderFooter(props: Record<string, unknown> = {}) {
  return render(ComfyHubPublishFooter, {
    props: { isFirstStep: false, isLastStep: true, ...props },
    global: {
      plugins: [i18n]
    }
  })
}

describe('ComfyHubPublishFooter', () => {
  it('shows the publish label for a new workflow', () => {
    renderFooter({ isUpdate: false })
    expect(
      screen.getByRole('button', { name: 'Publish to Comfy Workflows' })
    ).toBeInTheDocument()
  })

  it('shows the update label when the workflow is already published', () => {
    renderFooter({ isUpdate: true })
    expect(
      screen.getByRole('button', { name: 'Update workflow' })
    ).toBeInTheDocument()
  })
})
