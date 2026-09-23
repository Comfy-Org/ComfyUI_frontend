import { render, screen } from '@testing-library/vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { UploadModelDialogContext } from '@/platform/assets/composables/useUploadModelWizard'

import UploadModelConfirmation from './UploadModelConfirmation.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages },
  missingWarn: false,
  fallbackWarn: false,
  escapeParameter: true
})

const SingleSelectStub = {
  name: 'SingleSelect',
  props: {
    disabled: Boolean,
    modelValue: String
  },
  template:
    '<button type="button" :disabled="disabled">{{ modelValue }}</button>'
}

describe('UploadModelConfirmation', () => {
  it('shows missing-model replacement context and locks the model type', () => {
    const uploadContext: UploadModelDialogContext = {
      kind: 'missing-model-resolution',
      missingModelName: 'segm/person_yolov8m-seg.pt',
      requiredModelType: 'Ultralytics/bbox',
      replacementTargets: [
        {
          nodeId: '1',
          nodeLabel: 'Checkpoint Loader',
          widgetName: 'ckpt_name'
        }
      ]
    }

    render(UploadModelConfirmation, {
      props: {
        modelValue: 'Ultralytics/bbox',
        metadata: {
          content_length: 100,
          final_url: 'https://civitai.com/models/123',
          filename: 'replacement.safetensors'
        },
        uploadContext,
        'onUpdate:modelValue': () => {}
      },
      global: {
        plugins: [i18n],
        stubs: {
          SingleSelect: SingleSelectStub
        }
      }
    })

    expect(screen.getByText('segm/person_yolov8m-seg.pt')).toBeInTheDocument()
    expect(screen.getByText('Checkpoint Loader')).toBeInTheDocument()
    expect(screen.getByText('- ckpt_name')).toBeInTheDocument()
    const modelTypeSelect = screen.getByRole('button', {
      name: 'Ultralytics/bbox'
    })

    expect(modelTypeSelect).toBeDisabled()
    expect(
      screen.getByText((_content, element) => {
        return (
          element?.textContent ===
          'Locked to Ultralytics/bbox for this missing model'
        )
      })
    ).toBeInTheDocument()
  })
})
