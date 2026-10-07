import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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

describe('WorkflowTemplateDownloadFailure', () => {
  it.for([
    { reason: 'error', tooltip: 'Use Retry to try again.' },
    { reason: 'cancelled', tooltip: undefined }
  ] as const)(
    'shows tooltip $tooltip on the badge of a $reason download',
    async ({ reason, tooltip }) => {
      vi.useFakeTimers()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(WorkflowTemplateDownloadFailure, {
        props: {
          rowName: 'model.safetensors',
          state: { attempt: 1, reason, status: 'failed' }
        },
        global: { plugins: [i18n] }
      })

      await user.hover(screen.getByRole('status'))
      await vi.advanceTimersByTimeAsync(1000)

      expect(screen.queryByRole('tooltip')?.textContent.trim()).toBe(tooltip)
    }
  )
})
