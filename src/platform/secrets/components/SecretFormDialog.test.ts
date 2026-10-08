import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import SecretFormDialog from './SecretFormDialog.vue'
import * as secretsApi from '../api/secretsApi'
import type { SecretCredentialOption, SecretProviderInfo } from '../types'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

const textProvider: SecretProviderInfo = { id: 'huggingface' }
const jsonCredential = {
  credential_type: 'gcp_service_account',
  input_type: 'json_file',
  label: 'Service account'
} satisfies SecretCredentialOption
const jsonProvider: SecretProviderInfo = {
  id: 'gemini',
  credential_options: [jsonCredential]
}
const multipleCredentialProvider: SecretProviderInfo = {
  id: 'gemini',
  credential_options: [
    { credential_type: 'api_key', input_type: 'text', label: 'API key' },
    jsonCredential
  ]
}

function renderDialog(availableProviders: SecretProviderInfo[]) {
  return render(SecretFormDialog, {
    global: { plugins: [i18n] },
    props: { visible: true, availableProviders }
  })
}

async function selectProvider() {
  const user = userEvent.setup()
  await screen.findByRole('dialog')
  await user.click(screen.getByRole('combobox', { name: 'secrets.provider' }))
  await user.keyboard('{Home}{Enter}')
}

describe('SecretFormDialog', () => {
  it('does not render the JSON upload control for a text provider', async () => {
    renderDialog([textProvider])
    await selectProvider()

    expect(screen.queryByText('secrets.uploadJsonFile')).toBeNull()
    expect(
      screen.queryByPlaceholderText('secrets.jsonFilePlaceholder')
    ).toBeNull()
  })

  it('renders a file upload and textarea for a json_file provider', async () => {
    renderDialog([jsonProvider])
    await selectProvider()

    expect(await screen.findByText('secrets.uploadJsonFile')).toBeTruthy()
    expect(
      screen.getByPlaceholderText('secrets.jsonFilePlaceholder')
    ).toBeTruthy()
  })

  it('opens the file dialog when the JSON upload button is activated by keyboard', async () => {
    const fileClickSpy = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => {})

    renderDialog([jsonProvider])
    await selectProvider()

    const uploadButton = await screen.findByRole('button', {
      name: 'secrets.uploadJsonFile'
    })
    expect(uploadButton.tabIndex).not.toBe(-1)

    uploadButton.focus()
    await userEvent.keyboard('{Enter}')

    expect(fileClickSpy).toHaveBeenCalledOnce()
  })

  it('renders server-provided credential choices only for create forms with multiple options', async () => {
    const { unmount } = renderDialog([multipleCredentialProvider])
    await selectProvider()

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
      props: {
        visible: true,
        mode: 'edit',
        availableProviders: [multipleCredentialProvider],
        secret: {
          id: 'secret-1',
          name: 'Gemini',
          provider: 'gemini',
          created_at: '2026-01-01',
          updated_at: '2026-01-01'
        }
      }
    })

    await screen.findByRole('dialog')
    expect(screen.queryByText('secrets.credentialType')).toBeNull()
  })

  it('submits values entered through the form', async () => {
    const user = userEvent.setup()
    const createSecret = vi
      .spyOn(secretsApi, 'createSecret')
      .mockResolvedValue({
        id: 'secret-1',
        name: 'My token',
        provider: 'huggingface',
        created_at: '2026-01-01',
        updated_at: '2026-01-01'
      })
    renderDialog([textProvider])
    await selectProvider()

    await user.type(screen.getByLabelText('secrets.name'), '  My token  ')
    await user.type(screen.getByLabelText('secrets.secretValue'), 'secret-123')
    await user.click(screen.getByRole('button', { name: 'g.save' }))

    expect(createSecret).toHaveBeenCalledWith({
      name: 'My token',
      provider: 'huggingface',
      secret_value: 'secret-123'
    })
  })
})
