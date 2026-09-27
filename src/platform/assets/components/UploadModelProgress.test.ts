import { render, screen } from '@testing-library/vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import UploadModelProgress from './UploadModelProgress.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages },
  missingWarn: false,
  fallbackWarn: false,
  escapeParameter: true
})

describe('UploadModelProgress', () => {
  it('renders missing-model type mismatch labels', () => {
    render(UploadModelProgress, {
      props: {
        result: 'error',
        typeMismatch: {
          importedModelType: 'loras',
          importedModelTypeLabel: 'LoRA/Custom',
          requiredModelType: 'Ultralytics/bbox',
          requiredModelTypeLabel: 'Ultralytics/bbox'
        }
      },
      global: {
        plugins: [i18n]
      }
    })

    expect(
      screen.getByText('This model cannot resolve the missing model.')
    ).toBeInTheDocument()
    expect(screen.getByText('LoRA/Custom')).toBeInTheDocument()
    expect(screen.getAllByText('Ultralytics/bbox').length).toBeGreaterThan(0)
    expect(
      screen.getByText((_content, element) => {
        return (
          element?.textContent ===
          'Try importing a different Ultralytics/bbox model that this node can use.'
        )
      })
    ).toBeInTheDocument()
  })

  it('uses fallback copy when the imported model type label is unknown', () => {
    render(UploadModelProgress, {
      props: {
        result: 'error',
        typeMismatch: {
          requiredModelType: 'checkpoints',
          requiredModelTypeLabel: 'Checkpoint'
        }
      },
      global: {
        plugins: [i18n]
      }
    })

    expect(screen.getByText('another model type')).toBeInTheDocument()
    expect(
      screen.getByText((_content, element) => {
        return (
          element?.textContent ===
          'This file is already imported as another model type.'
        )
      })
    ).toBeInTheDocument()
  })
})
