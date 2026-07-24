import { render, screen } from '@testing-library/vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import UploadModelFooter from './UploadModelFooter.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages },
  missingWarn: false,
  fallbackWarn: false
})

function renderFooter(
  props: Partial<InstanceType<typeof UploadModelFooter>['$props']> = {}
) {
  render(UploadModelFooter, {
    props: {
      currentStep: 3,
      isFetchingMetadata: false,
      isUploading: false,
      canFetchMetadata: true,
      canUploadModel: true,
      uploadStatus: 'success',
      ...props
    },
    global: {
      plugins: [i18n],
      stubs: {
        VideoHelpDialog: true
      }
    }
  })
}

describe('UploadModelFooter', () => {
  it('allows importing another model by default', () => {
    renderFooter()

    expect(screen.getByRole('button', { name: 'Import Another' })).toBeEnabled()
  })

  it('disables importing another model when the upload resolves a missing model', () => {
    renderFooter({ canImportAnother: false })

    expect(
      screen.getByRole('button', { name: 'Import Another' })
    ).toBeDisabled()
  })

  it('shows recovery actions for upload errors', () => {
    renderFooter({ uploadStatus: 'error' })

    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })
})
