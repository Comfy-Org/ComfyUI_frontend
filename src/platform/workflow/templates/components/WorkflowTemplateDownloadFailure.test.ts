import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import WorkflowTemplateDownloadFailure from './WorkflowTemplateDownloadFailure.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      templateWorkflows: {
        detail: {
          downloadCancelled: 'Download cancelled',
          downloadFailed: 'Download failed',
          downloadFailedHint: 'Use Retry to try again.',
          retryDownload: 'Retry',
          retryDownloadNamed: 'Retry download for {model}'
        }
      }
    }
  }
})

function renderFailure(reason: 'cancelled' | 'error') {
  render(WorkflowTemplateDownloadFailure, {
    props: {
      rowName: 'model.safetensors',
      state: { attempt: 1, reason, status: 'failed' }
    },
    global: { plugins: [i18n] }
  })
}

describe('WorkflowTemplateDownloadFailure', () => {
  it('shows the retry hint when hovering the badge of a failed download', async () => {
    const user = userEvent.setup()
    renderFailure('error')

    await user.hover(screen.getByRole('status'))

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Use Retry to try again.'
    )
  })

  it('shows no tooltip when hovering the badge of a cancelled download', async () => {
    const user = userEvent.setup()
    renderFailure('cancelled')

    await user.hover(screen.getByRole('status'))

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
