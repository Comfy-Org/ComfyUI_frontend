import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'
import type {
  SettingSpec,
  SettingValue
} from '@/renderer/extensions/superComfy/engine/documentSchema'

import SettingField from './SettingField.vue'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

function renderField(spec: SettingSpec, modelValue?: SettingValue) {
  return render(SettingField, {
    props: { spec, modelValue },
    global: { plugins: [i18n] }
  })
}

const formatSpec: SettingSpec = {
  control: 'select',
  name: 'output_format',
  label: 'Output format',
  options: ['png', 'jpeg'],
  required: false
}

describe('SettingField', () => {
  it('names the model default in an unset select', () => {
    renderField(formatSpec)

    expect(
      screen.getByRole('combobox', { name: 'Output format' })
    ).toHaveTextContent('Model default')
  })

  it('shows the chosen option instead of the model default', async () => {
    renderField(formatSpec, 'jpeg')

    await vi.waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Output format' })
      ).toHaveTextContent('jpeg')
    )
  })

  it.for<{ name: string; spec: SettingSpec }>([
    {
      name: 'number',
      spec: {
        control: 'number',
        name: 'output_compression',
        label: 'Output compression',
        integer: true,
        required: false
      }
    },
    {
      name: 'text',
      spec: {
        control: 'text',
        name: 'size',
        label: 'Size',
        multiline: false,
        required: false
      }
    }
  ])('names the model default in an empty $name field', ({ spec }) => {
    renderField(spec)

    expect(screen.getByPlaceholderText('Model default')).toHaveAccessibleName(
      spec.label
    )
  })
})
