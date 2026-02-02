import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SecretMetadata } from '../types'
import { PROVIDER_NONE, useSecretForm } from './useSecretForm'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const mockCreate = vi.fn()
const mockUpdate = vi.fn()

vi.mock('../api/secretsApi', () => ({
  secretsApi: {
    create: (payload: unknown) => mockCreate(payload),
    update: (id: string, payload: unknown) => mockUpdate(id, payload)
  },
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

  describe('validate', () => {
    it('requires name in create mode', () => {
      const visible = ref(true)
      const { form, errors, validate } = useSecretForm({
        mode: 'create',
        existingProviders: [],
        visible,
        onSaved: vi.fn()
      })

      form.name = ''
      form.provider = 'huggingface'
      form.secretValue = 'secret123'

      expect(validate()).toBe(false)
      expect(errors.name).toBe('secrets.errors.nameRequired')
    })

    it('requires name not to exceed 255 characters', () => {
      const visible = ref(true)
      const { form, errors, validate } = useSecretForm({
        mode: 'create',
        existingProviders: [],
        visible,
        onSaved: vi.fn()
      })

      form.name = 'a'.repeat(256)
      form.provider = 'huggingface'
      form.secretValue = 'secret123'

      expect(validate()).toBe(false)
      expect(errors.name).toBe('secrets.errors.nameTooLong')
    })

    it('requires provider in create mode', () => {
      const visible = ref(true)
      const { form, errors, validate } = useSecretForm({
        mode: 'create',
        existingProviders: [],
        visible,
        onSaved: vi.fn()
      })

      form.name = 'My Secret'
      form.provider = PROVIDER_NONE
      form.secretValue = 'secret123'

      expect(validate()).toBe(false)
      expect(errors.provider).toBe('secrets.errors.providerRequired')
    })

    it('requires secret value in create mode', () => {
      const visible = ref(true)
      const { form, errors, validate } = useSecretForm({
        mode: 'create',
        existingProviders: [],
        visible,
        onSaved: vi.fn()
      })

      form.name = 'My Secret'
      form.provider = 'huggingface'
      form.secretValue = ''

      expect(validate()).toBe(false)
      expect(errors.secretValue).toBe('secrets.errors.secretValueRequired')
    })

    it('passes validation with valid create data', () => {
      const visible = ref(true)
      const { form, errors, validate } = useSecretForm({
        mode: 'create',
        existingProviders: [],
        visible,
        onSaved: vi.fn()
      })

      form.name = 'My Secret'
      form.provider = 'huggingface'
      form.secretValue = 'secret123'

      expect(validate()).toBe(true)
      expect(errors.name).toBe('')
      expect(errors.provider).toBe('')
      expect(errors.secretValue).toBe('')
    })

    it('allows empty secret value in edit mode', () => {
      const visible = ref(true)
      const secret = createMockSecret()
      const { form, validate } = useSecretForm({
        mode: 'edit',
        secret,
        existingProviders: [],
        visible,
        onSaved: vi.fn()
      })

      form.name = 'Updated Name'
      form.provider = PROVIDER_NONE
      form.secretValue = ''

      expect(validate()).toBe(true)
    })
  })

  describe('providerOptions', () => {
    it('marks existing providers as disabled', () => {
      const visible = ref(true)
      const { providerOptions } = useSecretForm({
        mode: 'create',
        existingProviders: ['huggingface'],
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

    it('includes none option in edit mode', () => {
      const visible = ref(true)
      const secret = createMockSecret()
      const { providerOptions } = useSecretForm({
        mode: 'edit',
        secret,
        existingProviders: [],
        visible,
        onSaved: vi.fn()
      })

      const noneOption = providerOptions.value.find(
        (o) => o.value === PROVIDER_NONE
      )
      expect(noneOption).toBeDefined()
      expect(noneOption?.label).toBe('g.none')
    })

    it('excludes none option in create mode', () => {
      const visible = ref(true)
      const { providerOptions } = useSecretForm({
        mode: 'create',
        existingProviders: [],
        visible,
        onSaved: vi.fn()
      })

      const noneOption = providerOptions.value.find(
        (o) => o.value === PROVIDER_NONE
      )
      expect(noneOption).toBeUndefined()
    })
  })

  describe('handleSubmit', () => {
    it('calls create API with correct payload', async () => {
      const visible = ref(true)
      const onSaved = vi.fn()
      mockCreate.mockResolvedValue({})

      const { form, handleSubmit } = useSecretForm({
        mode: 'create',
        existingProviders: [],
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
      const visible = ref(true)
      const onSaved = vi.fn()
      const secret = createMockSecret({ id: 'secret-123' })
      mockUpdate.mockResolvedValue({})

      const { form, handleSubmit } = useSecretForm({
        mode: 'edit',
        secret,
        existingProviders: [],
        visible,
        onSaved
      })

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
      const visible = ref(true)
      const secret = createMockSecret({ id: 'secret-123' })
      mockUpdate.mockResolvedValue({})

      const { form, handleSubmit } = useSecretForm({
        mode: 'edit',
        secret,
        existingProviders: [],
        visible,
        onSaved: vi.fn()
      })

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
        existingProviders: [],
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

  describe('resetForm', () => {
    it('resets to empty state in create mode', () => {
      const visible = ref(false)
      const { form, errors, resetForm } = useSecretForm({
        mode: 'create',
        existingProviders: [],
        visible,
        onSaved: vi.fn()
      })

      form.name = 'Some Name'
      form.secretValue = 'some value'
      errors.name = 'some error'

      resetForm()

      expect(form.name).toBe('')
      expect(form.secretValue).toBe('')
      expect(form.provider).toBe(PROVIDER_NONE)
      expect(errors.name).toBe('')
    })

    it('resets to secret values in edit mode', () => {
      const visible = ref(false)
      const secret = createMockSecret({
        name: 'Original Name',
        provider: 'civitai'
      })
      const { form, resetForm } = useSecretForm({
        mode: 'edit',
        secret,
        existingProviders: [],
        visible,
        onSaved: vi.fn()
      })

      form.name = 'Changed Name'

      resetForm()

      expect(form.name).toBe('Original Name')
      expect(form.provider).toBe('civitai')
      expect(form.secretValue).toBe('')
    })
  })
})
