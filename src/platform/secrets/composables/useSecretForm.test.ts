import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  SecretMetadata,
  SecretProvider,
  SecretProviderInfo
} from '../types'
import { useSecretForm } from './useSecretForm'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const mockCreate = vi.fn()
const mockUpdate = vi.fn()

vi.mock('../api/secretsApi', () => ({
  createSecret: (payload: unknown) => mockCreate(payload),
  updateSecret: (id: string, payload: unknown) => mockUpdate(id, payload),
  SecretsApiError: class SecretsApiError extends Error {
    constructor(
      message: string,
      public readonly status?: number,
      public readonly code?: string
    ) {
      super(message)
      this.name = 'SecretsApiError'
    }
  }
}))

function createMockSecret(
  overrides: Partial<SecretMetadata> = {}
): SecretMetadata {
  return {
    id: 'secret-1',
    name: 'Test Secret',
    provider: 'huggingface',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides
  }
}

describe('useSecretForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validation via handleSubmit', () => {
    it('requires name in create mode', async () => {
      const visible = ref(true)
      const { form, errors, handleSubmit } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        visible,
        onSaved: vi.fn()
      })

      form.name = ''
      form.provider = 'huggingface'
      form.secretValue = 'secret123'

      await handleSubmit()

      expect(mockCreate).not.toHaveBeenCalled()
      expect(errors.name).toBe('secrets.errors.nameRequired')
    })

    it('requires name not to exceed 255 characters', async () => {
      const visible = ref(true)
      const { form, errors, handleSubmit } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        visible,
        onSaved: vi.fn()
      })

      form.name = 'a'.repeat(256)
      form.provider = 'huggingface'
      form.secretValue = 'secret123'

      await handleSubmit()

      expect(mockCreate).not.toHaveBeenCalled()
      expect(errors.name).toBe('secrets.errors.nameTooLong')
    })

    it('requires provider in create mode', async () => {
      const visible = ref(true)
      const { form, errors, handleSubmit } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        visible,
        onSaved: vi.fn()
      })

      form.name = 'My Secret'
      form.provider = null
      form.secretValue = 'secret123'

      await handleSubmit()

      expect(mockCreate).not.toHaveBeenCalled()
      expect(errors.provider).toBe('secrets.errors.providerRequired')
    })

    it('requires secret value in create mode', async () => {
      const visible = ref(true)
      const { form, errors, handleSubmit } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        visible,
        onSaved: vi.fn()
      })

      form.name = 'My Secret'
      form.provider = 'huggingface'
      form.secretValue = ''

      await handleSubmit()

      expect(mockCreate).not.toHaveBeenCalled()
      expect(errors.secretValue).toBe('secrets.errors.secretValueRequired')
    })

    it('allows empty secret value in edit mode', async () => {
      const visible = ref(false)
      const secret = createMockSecret()
      mockUpdate.mockResolvedValue({})
      const { form, handleSubmit } = useSecretForm({
        mode: 'edit',
        secret: () => secret,
        existingProviders: () => [],
        visible,
        onSaved: vi.fn()
      })

      visible.value = true
      await Promise.resolve()

      form.name = 'Updated Name'
      form.secretValue = ''

      await handleSubmit()

      expect(mockUpdate).toHaveBeenCalled()
    })

    it('requires provider in edit mode', async () => {
      const visible = ref(true)
      const secret = createMockSecret({ provider: undefined })
      const { form, errors, handleSubmit } = useSecretForm({
        mode: 'edit',
        secret: () => secret,
        existingProviders: () => [],
        visible,
        onSaved: vi.fn()
      })

      form.name = 'Updated Name'
      form.provider = null

      await handleSubmit()

      expect(mockUpdate).not.toHaveBeenCalled()
      expect(errors.provider).toBe('secrets.errors.providerRequired')
    })
  })

  describe('providerOptions', () => {
    it('marks existing providers as disabled', () => {
      const visible = ref(true)
      const { providerOptions } = useSecretForm({
        mode: 'create',
        existingProviders: () => ['huggingface'],
        visible,
        onSaved: vi.fn()
      })

      const huggingface = providerOptions.value.find(
        (o) => o.value === 'huggingface'
      )
      const civitai = providerOptions.value.find((o) => o.value === 'civitai')

      expect(huggingface?.disabled).toBe(true)
      expect(civitai?.disabled).toBe(false)
    })

    it('falls back to all base providers when availableProviders is not loaded', () => {
      const visible = ref(true)
      const { providerOptions } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        availableProviders: () => null,
        visible,
        onSaved: vi.fn()
      })

      expect(providerOptions.value.map((o) => o.value)).toEqual([
        'huggingface',
        'civitai'
      ])
    })

    it('shows no options when the server returns an empty allowlist', () => {
      const visible = ref(true)
      const { providerOptions } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        availableProviders: () => [],
        visible,
        onSaved: vi.fn()
      })

      expect(providerOptions.value).toEqual([])
    })

    it('restricts options to the providers returned by the server', () => {
      const visible = ref(true)
      const { providerOptions } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        availableProviders: () => [{ id: 'civitai' }],
        visible,
        onSaved: vi.fn()
      })

      expect(providerOptions.value.map((o) => o.value)).toEqual(['civitai'])
    })

    it('dedupes repeated provider ids from the server', () => {
      const visible = ref(true)
      const { providerOptions } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        availableProviders: () => [
          { id: 'civitai' },
          { id: 'civitai' },
          { id: 'huggingface' }
        ],
        visible,
        onSaved: vi.fn()
      })

      expect(providerOptions.value.map((o) => o.value)).toEqual([
        'civitai',
        'huggingface'
      ])
    })

    it('renders server-listed BYOK providers with labels and logos', () => {
      const visible = ref(true)
      const { providerOptions } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        availableProviders: () => [{ id: 'runway' }, { id: 'gemini' }],
        visible,
        onSaved: vi.fn()
      })

      expect(providerOptions.value).toEqual([
        {
          value: 'runway',
          label: 'Runway',
          logo: '/assets/images/runway.svg',
          disabled: false
        },
        {
          value: 'gemini',
          label: 'Google Gemini',
          logo: '/assets/images/gemini.svg',
          disabled: false
        }
      ])
    })

    it('passes a server-listed provider absent from the local registry through with its raw id as label and no logo', () => {
      const visible = ref(true)
      const { providerOptions } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        availableProviders: () => [{ id: 'brand-new-provider' }],
        visible,
        onSaved: vi.fn()
      })

      expect(providerOptions.value).toEqual([
        {
          value: 'brand-new-provider',
          label: 'brand-new-provider',
          logo: undefined,
          disabled: false
        }
      ])
      expect(providerOptions.value[0]?.logo).toBeUndefined()
    })

    it('omits BYOK providers the server does not list', () => {
      const visible = ref(true)
      const { providerOptions } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        availableProviders: () => [{ id: 'huggingface' }],
        visible,
        onSaved: vi.fn()
      })

      const values = providerOptions.value.map((o) => o.value)
      expect(values).toEqual(['huggingface'])
      expect(values).not.toContain('runway')
      expect(values).not.toContain('gemini')
    })

    it('reacts to availableProviders changing', () => {
      const visible = ref(true)
      const availableProviders = ref<SecretProviderInfo[] | null>(null)
      const { providerOptions } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        availableProviders: () => availableProviders.value,
        visible,
        onSaved: vi.fn()
      })

      expect(providerOptions.value).toHaveLength(2)

      availableProviders.value = [{ id: 'huggingface' }]

      expect(providerOptions.value.map((o) => o.value)).toEqual(['huggingface'])
    })

    it('clears a selection the resolved allowlist no longer offers', async () => {
      const visible = ref(true)
      const availableProviders = ref<SecretProviderInfo[] | null>(null)
      const { form, providerOptions } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        availableProviders: () => availableProviders.value,
        visible,
        onSaved: vi.fn()
      })

      form.provider = 'civitai'
      availableProviders.value = [{ id: 'huggingface' }]
      await nextTick()

      expect(providerOptions.value.map((o) => o.value)).toEqual(['huggingface'])
      expect(form.provider).toBeNull()
    })

    it('keeps a selection the resolved allowlist still offers', async () => {
      const visible = ref(true)
      const availableProviders = ref<SecretProviderInfo[] | null>(null)
      const { form } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        availableProviders: () => availableProviders.value,
        visible,
        onSaved: vi.fn()
      })

      form.provider = 'huggingface'
      availableProviders.value = [{ id: 'huggingface' }, { id: 'civitai' }]
      await nextTick()

      expect(form.provider).toBe('huggingface')
    })

    it('ignores the availableProviders filter in edit mode', () => {
      const visible = ref(true)
      const { providerOptions } = useSecretForm({
        mode: 'edit',
        secret: () => createMockSecret({ provider: 'huggingface' }),
        existingProviders: () => [],
        availableProviders: () => [{ id: 'civitai' }],
        visible,
        onSaved: vi.fn()
      })

      expect(providerOptions.value.map((o) => o.value)).toEqual([
        'huggingface',
        'civitai'
      ])
    })

    it('updates disabled state when existingProviders changes', () => {
      const visible = ref(true)
      const existingProviders = ref<SecretProvider[]>(['huggingface'])
      const { providerOptions } = useSecretForm({
        mode: 'create',
        existingProviders: () => existingProviders.value,
        visible,
        onSaved: vi.fn()
      })

      expect(
        providerOptions.value.find((o) => o.value === 'huggingface')?.disabled
      ).toBe(true)

      existingProviders.value = []

      expect(
        providerOptions.value.find((o) => o.value === 'huggingface')?.disabled
      ).toBe(false)
    })
  })

  describe('providerHelp', () => {
    it('uses the generic hint when no provider is selected', () => {
      const visible = ref(true)
      const { providerHelp } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        visible,
        onSaved: vi.fn()
      })

      // t() is mocked to echo the key.
      expect(providerHelp.value).toBe('secrets.providerHint')
    })

    it('uses provider-specific help when a BYOK provider is selected', () => {
      const visible = ref(true)
      const { form, providerHelp } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        availableProviders: () => [{ id: 'runway' }, { id: 'gemini' }],
        visible,
        onSaved: vi.fn()
      })

      form.provider = 'runway'
      expect(providerHelp.value).toBe('secrets.providerHelp.runway')

      form.provider = 'gemini'
      expect(providerHelp.value).toBe('secrets.providerHelp.gemini')
    })

    it('falls back to the generic hint for a provider without a help key', () => {
      const visible = ref(true)
      const { form, providerHelp } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        visible,
        onSaved: vi.fn()
      })

      form.provider = 'huggingface'
      expect(providerHelp.value).toBe('secrets.providerHint')
    })
  })

  describe('server-driven provider metadata', () => {
    it('prefers the server-provided label over the registry label', () => {
      const visible = ref(true)
      const { providerOptions } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        availableProviders: () => [{ id: 'gemini', label: 'Gemini (Vertex)' }],
        visible,
        onSaved: vi.fn()
      })

      expect(
        providerOptions.value.find((o) => o.value === 'gemini')?.label
      ).toBe('Gemini (Vertex)')
    })

    it('defaults selectedInputType to text', () => {
      const visible = ref(true)
      const { form, selectedInputType } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        availableProviders: () => [{ id: 'gemini' }],
        visible,
        onSaved: vi.fn()
      })

      expect(selectedInputType.value).toBe('text')
      form.provider = 'gemini'
      expect(selectedInputType.value).toBe('text')
    })

    it('reports json_file input type for a json_file provider', () => {
      const visible = ref(true)
      const { form, selectedInputType } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        availableProviders: () => [{ id: 'gemini', input_type: 'json_file' }],
        visible,
        onSaved: vi.fn()
      })

      form.provider = 'gemini'
      expect(selectedInputType.value).toBe('json_file')
    })
  })

  describe('stored credential type in edit mode', () => {
    it('uses json_file input for a stored gcp_service_account secret even when provider metadata omits input_type', async () => {
      const visible = ref(false)
      const secret = createMockSecret({
        provider: 'gemini',
        credential_type: 'gcp_service_account'
      })

      const { selectedInputType } = useSecretForm({
        mode: 'edit',
        secret: () => secret,
        existingProviders: () => ['gemini'],
        availableProviders: () => [{ id: 'gemini' }],
        visible,
        onSaved: vi.fn()
      })

      visible.value = true
      await Promise.resolve()

      expect(selectedInputType.value).toBe('json_file')
    })

    it('validates the updated value as JSON for a stored gcp_service_account secret', async () => {
      const visible = ref(false)
      const secret = createMockSecret({
        id: 'secret-sa',
        provider: 'gemini',
        credential_type: 'gcp_service_account'
      })
      mockUpdate.mockResolvedValue({})

      const { form, errors, handleSubmit } = useSecretForm({
        mode: 'edit',
        secret: () => secret,
        existingProviders: () => ['gemini'],
        visible,
        onSaved: vi.fn()
      })

      visible.value = true
      await Promise.resolve()

      form.secretValue = 'not json'
      await handleSubmit()

      expect(mockUpdate).not.toHaveBeenCalled()
      expect(errors.secretValue).toBe('secrets.errors.invalidJson')

      form.secretValue = '{"type":"service_account"}'
      await handleSubmit()

      expect(mockUpdate).toHaveBeenCalledWith('secret-sa', {
        name: secret.name,
        secret_value: '{"type":"service_account"}'
      })
    })

    it('uses text input for a stored api_key secret even when the provider is a json_file provider', async () => {
      const visible = ref(false)
      const secret = createMockSecret({
        id: 'secret-key',
        provider: 'gemini',
        credential_type: 'api_key'
      })
      mockUpdate.mockResolvedValue({})

      const { form, selectedInputType, handleSubmit } = useSecretForm({
        mode: 'edit',
        secret: () => secret,
        existingProviders: () => ['gemini'],
        availableProviders: () => [{ id: 'gemini', input_type: 'json_file' }],
        visible,
        onSaved: vi.fn()
      })

      visible.value = true
      await Promise.resolve()

      expect(selectedInputType.value).toBe('text')

      form.secretValue = 'plain-api-key'
      await handleSubmit()

      expect(mockUpdate).toHaveBeenCalledWith('secret-key', {
        name: secret.name,
        secret_value: 'plain-api-key'
      })
    })

    it('falls back to provider input_type for a secret without a stored credential type', async () => {
      const visible = ref(false)
      const secret = createMockSecret({ provider: 'gemini' })

      const { selectedInputType } = useSecretForm({
        mode: 'edit',
        secret: () => secret,
        existingProviders: () => ['gemini'],
        availableProviders: () => [{ id: 'gemini', input_type: 'json_file' }],
        visible,
        onSaved: vi.fn()
      })

      visible.value = true
      await Promise.resolve()

      expect(selectedInputType.value).toBe('json_file')
    })
  })

  describe('json_file credential input', () => {
    const vertexProviders: SecretProviderInfo[] = [
      { id: 'gemini', input_type: 'json_file' }
    ]

    it('loads file contents into the secret value', async () => {
      const visible = ref(true)
      const { form, fileName, loadSecretFromFile } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        visible,
        onSaved: vi.fn()
      })

      const file = new File(['{"type":"service_account"}'], 'sa.json', {
        type: 'application/json'
      })
      await loadSecretFromFile(file)

      expect(form.secretValue).toBe('{"type":"service_account"}')
      expect(fileName.value).toBe('sa.json')
    })

    it('rejects invalid JSON for a json_file provider', async () => {
      const visible = ref(true)
      const { form, errors, handleSubmit } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        availableProviders: () => vertexProviders,
        visible,
        onSaved: vi.fn()
      })

      form.name = 'Vertex SA'
      form.provider = 'gemini'
      form.secretValue = 'not json'

      await handleSubmit()

      expect(mockCreate).not.toHaveBeenCalled()
      expect(errors.secretValue).toBe('secrets.errors.invalidJson')
    })

    it('rejects JSON that is not an object for a json_file provider', async () => {
      const visible = ref(true)
      const { form, errors, handleSubmit } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        availableProviders: () => vertexProviders,
        visible,
        onSaved: vi.fn()
      })

      form.name = 'Vertex SA'
      form.provider = 'gemini'
      form.secretValue = '["not", "an", "object"]'

      await handleSubmit()

      expect(mockCreate).not.toHaveBeenCalled()
      expect(errors.secretValue).toBe('secrets.errors.invalidJson')
    })

    it('rejects a file larger than the size cap', async () => {
      const visible = ref(true)
      const { form, fileName, errors, loadSecretFromFile } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        visible,
        onSaved: vi.fn()
      })

      const oversized = new File(['x'.repeat(1024 * 1024 + 1)], 'big.json', {
        type: 'application/json'
      })
      await loadSecretFromFile(oversized)

      expect(form.secretValue).toBe('')
      expect(fileName.value).toBe('')
      expect(errors.secretValue).toBe('secrets.errors.fileTooLarge')
    })

    it('reports an error when the file read fails', async () => {
      const visible = ref(true)
      const { errors, loadSecretFromFile } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        visible,
        onSaved: vi.fn()
      })

      const unreadable = {
        name: 'sa.json',
        size: 20,
        text: () => Promise.reject(new Error('read failed'))
      } as unknown as File
      await loadSecretFromFile(unreadable)

      expect(errors.secretValue).toBe('secrets.errors.fileReadFailed')
    })

    it('clears an uploaded credential when the provider changes', async () => {
      const visible = ref(true)
      const { form, fileName, loadSecretFromFile } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        availableProviders: () => vertexProviders,
        visible,
        onSaved: vi.fn()
      })

      form.provider = 'gemini'
      await nextTick()
      const file = new File(['{"type":"service_account"}'], 'sa.json', {
        type: 'application/json'
      })
      await loadSecretFromFile(file)
      expect(form.secretValue).toBe('{"type":"service_account"}')

      form.provider = 'huggingface'
      await nextTick()

      expect(form.secretValue).toBe('')
      expect(fileName.value).toBe('')
    })

    it('discards a file read superseded by a provider change', async () => {
      const visible = ref(true)
      const { form, fileName, loadSecretFromFile } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        availableProviders: () => vertexProviders,
        visible,
        onSaved: vi.fn()
      })

      form.provider = 'gemini'
      await nextTick()

      let resolveRead: (value: string) => void = () => {}
      const slowFile = {
        name: 'sa.json',
        size: 26,
        text: () =>
          new Promise<string>((resolve) => {
            resolveRead = resolve
          })
      } as unknown as File

      const pending = loadSecretFromFile(slowFile)
      form.provider = 'huggingface'
      await nextTick()
      resolveRead('{"type":"service_account"}')
      await pending

      expect(form.secretValue).toBe('')
      expect(fileName.value).toBe('')
    })

    it('submits valid JSON for a json_file provider', async () => {
      const visible = ref(true)
      mockCreate.mockResolvedValue({})
      const { form, handleSubmit } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        availableProviders: () => vertexProviders,
        visible,
        onSaved: vi.fn()
      })

      form.name = 'Vertex SA'
      form.provider = 'gemini'
      form.secretValue = '{"type":"service_account"}'

      await handleSubmit()

      expect(mockCreate).toHaveBeenCalledWith({
        name: 'Vertex SA',
        secret_value: '{"type":"service_account"}',
        provider: 'gemini'
      })
    })
  })

  describe('handleSubmit', () => {
    it('calls create API with correct payload', async () => {
      const visible = ref(true)
      const onSaved = vi.fn()
      mockCreate.mockResolvedValue({})

      const { form, handleSubmit } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        visible,
        onSaved
      })

      form.name = 'My Secret'
      form.provider = 'civitai'
      form.secretValue = 'secret123'

      await handleSubmit()

      expect(mockCreate).toHaveBeenCalledWith({
        name: 'My Secret',
        secret_value: 'secret123',
        provider: 'civitai'
      })
      expect(onSaved).toHaveBeenCalled()
      expect(visible.value).toBe(false)
    })

    it('calls update API with correct payload', async () => {
      const visible = ref(false)
      const onSaved = vi.fn()
      const secret = createMockSecret({ id: 'secret-123' })
      mockUpdate.mockResolvedValue({})

      const { form, handleSubmit } = useSecretForm({
        mode: 'edit',
        secret: () => secret,
        existingProviders: () => [],
        visible,
        onSaved
      })

      visible.value = true
      await Promise.resolve()

      form.name = 'Updated Name'
      form.secretValue = 'newvalue'

      await handleSubmit()

      expect(mockUpdate).toHaveBeenCalledWith('secret-123', {
        name: 'Updated Name',
        secret_value: 'newvalue'
      })
      expect(onSaved).toHaveBeenCalled()
    })

    it('omits secret_value in update if empty', async () => {
      const visible = ref(false)
      const secret = createMockSecret({ id: 'secret-123' })
      mockUpdate.mockResolvedValue({})

      const { form, handleSubmit } = useSecretForm({
        mode: 'edit',
        secret: () => secret,
        existingProviders: () => [],
        visible,
        onSaved: vi.fn()
      })

      visible.value = true
      await Promise.resolve()

      form.name = 'Updated Name'
      form.secretValue = ''

      await handleSubmit()

      expect(mockUpdate).toHaveBeenCalledWith('secret-123', {
        name: 'Updated Name'
      })
    })

    it('sets apiError on API failure', async () => {
      const { SecretsApiError } = await import('../api/secretsApi')
      const visible = ref(true)
      mockCreate.mockRejectedValue(
        new SecretsApiError('Duplicate', 400, 'DUPLICATE_NAME')
      )

      const { form, apiError, handleSubmit } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        visible,
        onSaved: vi.fn()
      })

      form.name = 'My Secret'
      form.provider = 'huggingface'
      form.secretValue = 'secret123'

      await handleSubmit()

      expect(apiError.value).toBe('secrets.errors.duplicateName')
      expect(visible.value).toBe(true)
    })
  })

  describe('form reset on visible', () => {
    it('resets to empty state in create mode when visible becomes true', async () => {
      const visible = ref(false)
      const { form, errors } = useSecretForm({
        mode: 'create',
        existingProviders: () => [],
        visible,
        onSaved: vi.fn()
      })

      form.name = 'Some Name'
      form.secretValue = 'some value'
      errors.name = 'some error'

      visible.value = true
      await Promise.resolve()

      expect(form.name).toBe('')
      expect(form.secretValue).toBe('')
      expect(form.provider).toBeNull()
      expect(errors.name).toBe('')
    })

    it('resets to secret values in edit mode when visible becomes true', async () => {
      const visible = ref(false)
      const secret = createMockSecret({
        name: 'Original Name',
        provider: 'civitai'
      })
      const { form } = useSecretForm({
        mode: 'edit',
        secret: () => secret,
        existingProviders: () => [],
        visible,
        onSaved: vi.fn()
      })

      form.name = 'Changed Name'

      visible.value = true
      await Promise.resolve()

      expect(form.name).toBe('Original Name')
      expect(form.provider).toBe('civitai')
      expect(form.secretValue).toBe('')
    })
  })
})
