import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import MissingModelStatusCard from './MissingModelStatusCard.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      electronFileDownload: {
        cancelled: 'Cancelled',
        paused: 'Paused'
      },
      rightSidePanel: {
        missingModels: {
          alreadyExistsInCategory: 'Already exists in {category}',
          cancelSelection: 'Cancel selection',
          imported: 'Imported',
          importing: 'Importing',
          importFailed: 'Import failed',
          usingFromLibrary: 'Using from library'
        }
      }
    }
  },
  missingWarn: false,
  fallbackWarn: false
})

function renderComponent(canCancelSelection = true) {
  return render(MissingModelStatusCard, {
    props: {
      modelName: 'model.safetensors',
      isDownloadActive: true,
      downloadStatus: {
        progress: 0.4,
        status: 'running'
      },
      canCancelSelection
    },
    global: {
      plugins: [i18n]
    }
  })
}

describe('MissingModelStatusCard', () => {
  it('shows the cancel selection control by default', () => {
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Cancel selection' })
    ).toBeVisible()
  })

  it('hides the cancel selection control when cancellation is disabled', () => {
    renderComponent(false)

    expect(
      screen.queryByRole('button', { name: 'Cancel selection' })
    ).not.toBeInTheDocument()
  })
})
