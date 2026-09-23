import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import SecretFormDialog from './SecretFormDialog.vue'
import type { SecretCredentialOption, SecretInputType } from '../types'

const mockState = vi.hoisted(() => ({
  inputType: 'text' as SecretInputType,
  credentialOptions: [] as SecretCredentialOption[]
}))

vi.mock<unknown>(import('../composables/useSecretForm'), () => ({
  useSecretForm: () => ({
    form: { provider: '', name: '', secretValue: '' },
    errors: {},
    loading: false,
    apiError: '',
    providerOptions: [],
    providerHelp: '',
    selectedInputType: computed(() => mockState.inputType),
    credentialOptions: computed(() => mockState.credentialOptions),
    credentialType: ref<string | null>(null),
    fileName: ref(''),
    loadSecretFromFile: vi.fn(),
    handleSubmit: vi.fn()
  })
}))

vi.mock<unknown>(
  import('primevue/inputtext'), // eslint-disable-line primevue-removal/no-imports

  () => ({
    default: { name: 'InputText', template: '<input />' }
  })
)
vi.mock<unknown>(
  import('primevue/password'), // eslint-disable-line primevue-removal/no-imports
  () => ({
    default: { name: 'Password', template: '<input type="password" />' }
  })
)

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

describe('SecretFormDialog', () => {
  beforeEach(() => {
    mockState.inputType = 'text'
    mockState.credentialOptions = []
  })

  it('does not render the JSON upload control for a text provider', async () => {
    render(SecretFormDialog, {
      global: { plugins: [i18n] },
      props: { visible: true }
    })

    await screen.findByRole('dialog')
    expect(screen.queryByText('secrets.uploadJsonFile')).toBeNull()
    expect(
      screen.queryByPlaceholderText('secrets.jsonFilePlaceholder')
    ).toBeNull()
  })

  it('renders a file upload and textarea for a json_file provider', async () => {
    mockState.inputType = 'json_file'

    render(SecretFormDialog, {
      global: { plugins: [i18n] },
      props: { visible: true }
    })

    expect(await screen.findByText('secrets.uploadJsonFile')).toBeTruthy()
    expect(
      screen.getByPlaceholderText('secrets.jsonFilePlaceholder')
    ).toBeTruthy()
  })

  it('opens the file dialog when the JSON upload button is activated by keyboard', async () => {
    mockState.inputType = 'json_file'

    const fileClickSpy = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => {})

    render(SecretFormDialog, {
      global: { plugins: [i18n] },
      props: { visible: true }
    })

    const uploadButton = await screen.findByRole('button', {
      name: 'secrets.uploadJsonFile'
    })
    expect(uploadButton.tabIndex).not.toBe(-1)

    uploadButton.focus()
    await userEvent.keyboard('{Enter}')

    expect(fileClickSpy).toHaveBeenCalledOnce()
  })

  it('renders server-provided credential choices only for create forms with multiple options', async () => {
    mockState.credentialOptions = [
      { credential_type: 'api_key', input_type: 'text', label: 'API key' },
      {
        credential_type: 'gcp_service_account',
        input_type: 'json_file',
        label: 'Service account'
      }
    ]

    const { unmount } = render(SecretFormDialog, {
      global: { plugins: [i18n] },
      props: { visible: true }
    })

    expect(await screen.findByText('secrets.credentialType')).toBeTruthy()
    const user = userEvent.setup()
    const credentialSelect = screen.getByRole('combobox', {
      name: 'secrets.credentialType'
    })
    await user.click(credentialSelect)
    await user.keyboard('{Home}{Enter}')
    expect(credentialSelect).toHaveTextContent('API key')
    await user.click(credentialSelect)
    await user.keyboard('{End}{Enter}')
    expect(credentialSelect).toHaveTextContent('Service account')

    unmount()
    render(SecretFormDialog, {
      global: { plugins: [i18n] },
      props: { visible: true, mode: 'edit' }
    })

    await screen.findByRole('dialog')
    expect(screen.queryByText('secrets.credentialType')).toBeNull()
  })
})
