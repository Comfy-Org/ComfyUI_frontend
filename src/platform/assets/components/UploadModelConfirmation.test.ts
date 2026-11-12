import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'
import { ref, shallowRef } from 'vue'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useModelTypes } from '@/platform/assets/composables/useModelTypes'
import type { UploadModelDialogContext } from '@/platform/assets/composables/useUploadModelWizard'

import UploadModelConfirmation from './UploadModelConfirmation.vue'

vi.mock(import('@/platform/assets/composables/useModelTypes'), () => ({
  useModelTypes: vi.fn(() => ({
    modelTypes: ref([
      { name: 'Bounding Box', value: 'Ultralytics/bbox' },
      { name: 'LoRA', value: 'loras' }
    ]),
    isLoading: ref(false),
    error: shallowRef<unknown>(),
    fetchModelTypes: vi.fn(async () => {})
  }))
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages },
  missingWarn: false,
  fallbackWarn: false,
  escapeParameter: true
})

describe('UploadModelConfirmation', () => {
  it('shows missing-model replacement context and locks the model type', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
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
        'onUpdate:modelValue': onUpdate
      },
      global: {
        plugins: [i18n]
      }
    })

    expect(screen.getByText('segm/person_yolov8m-seg.pt')).toBeInTheDocument()
    expect(screen.getByText('Checkpoint Loader')).toBeInTheDocument()
    expect(screen.getByText('- ckpt_name')).toBeInTheDocument()
    const modelTypeSelect = screen.getByRole('combobox')

    expect(modelTypeSelect).toBeDisabled()
    await waitFor(() =>
      expect(modelTypeSelect).toHaveTextContent('Bounding Box')
    )
    await user.click(modelTypeSelect)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onUpdate).not.toHaveBeenCalled()
    expect(
      screen.getByText((_content, element) => {
        return (
          element?.textContent ===
          'Locked to Bounding Box for this missing model'
        )
      })
    ).toBeInTheDocument()
  })

  it('shows the required model type when its display name is unavailable', () => {
    vi.mocked(useModelTypes).mockReturnValueOnce({
      ...useModelTypes(),
      modelTypes: ref([])
    })

    render(UploadModelConfirmation, {
      props: {
        modelValue: 'Ultralytics/bbox',
        uploadContext: {
          kind: 'missing-model-resolution',
          missingModelName: 'segm/person_yolov8m-seg.pt',
          requiredModelType: 'Ultralytics/bbox',
          replacementTargets: []
        }
      },
      global: { plugins: [i18n] }
    })

    expect(
      screen.getByText((_content, element) => {
        return (
          element?.textContent ===
          'Locked to Ultralytics/bbox for this missing model'
        )
      })
    ).toBeInTheDocument()
  })

  it('updates the model type from the selected option for a normal import', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(UploadModelConfirmation, {
      props: {
        modelValue: 'Ultralytics/bbox',
        'onUpdate:modelValue': onUpdate
      },
      global: { plugins: [i18n] }
    })

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'LoRA' }))

    expect(onUpdate).toHaveBeenCalledWith('loras')
  })
})
