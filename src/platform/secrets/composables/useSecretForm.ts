import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { SecretsApiError, secretsApi } from '../api/secretsApi'
import { SECRET_PROVIDERS } from '../providers'
import type { SecretErrorCode, SecretMetadata, SecretProvider } from '../types'

export const PROVIDER_NONE = '__none__' as const

interface SecretFormState {
  name: string
  secretValue: string
  provider: SecretProvider | typeof PROVIDER_NONE
}

interface SecretFormErrors {
  name: string
  secretValue: string
  provider: string
}

interface ProviderOption {
  label: string
  value: SecretProvider | typeof PROVIDER_NONE
  disabled: boolean
}

interface UseSecretFormOptions {
  mode: 'create' | 'edit'
  secret?: SecretMetadata
  existingProviders: SecretProvider[]
  visible: { value: boolean }
  onSaved: () => void
}

export function useSecretForm(options: UseSecretFormOptions) {
  const { t } = useI18n()
  const { mode, secret, existingProviders, visible, onSaved } = options

  const loading = ref(false)
  const apiErrorCode = ref<SecretErrorCode | null>(null)
  const apiErrorMessage = ref<string | null>(null)

  const form = reactive<SecretFormState>({
    name: '',
    secretValue: '',
    provider: PROVIDER_NONE
  })

  const errors = reactive<SecretFormErrors>({
    name: '',
    secretValue: '',
    provider: ''
  })

  const providerOptions = computed<ProviderOption[]>(() => {
    const opts: ProviderOption[] = SECRET_PROVIDERS.map((p) => ({
      label: p.label,
      value: p.value,
      disabled: existingProviders.includes(p.value)
    }))
    if (mode === 'edit') {
      opts.unshift({
        label: t('g.none'),
        value: PROVIDER_NONE,
        disabled: false
      })
    }
    return opts
  })

  const apiError = computed(() => {
    if (!apiErrorCode.value && !apiErrorMessage.value) return null
    switch (apiErrorCode.value) {
      case 'DUPLICATE_NAME':
        return t('secrets.errors.duplicateName')
      case 'DUPLICATE_PROVIDER':
        return t('secrets.errors.duplicateProvider')
      default:
        return apiErrorMessage.value
    }
  })

  function resetForm() {
    if (mode === 'edit' && secret) {
      form.name = secret.name
      form.provider = secret.provider ?? PROVIDER_NONE
      form.secretValue = ''
    } else {
      form.name = ''
      form.secretValue = ''
      form.provider = PROVIDER_NONE
    }
    errors.name = ''
    errors.secretValue = ''
    errors.provider = ''
    apiErrorCode.value = null
    apiErrorMessage.value = null
  }

  watch(
    () => visible.value,
    (isVisible) => {
      if (isVisible) resetForm()
    }
  )

  function validate(): boolean {
    errors.name = ''
    errors.secretValue = ''
    errors.provider = ''

    if (!form.name.trim()) {
      errors.name = t('secrets.errors.nameRequired')
      return false
    }
    if (form.name.length > 255) {
      errors.name = t('secrets.errors.nameTooLong')
      return false
    }
    if (mode === 'create' && form.provider === PROVIDER_NONE) {
      errors.provider = t('secrets.errors.providerRequired')
      return false
    }
    if (mode === 'create' && !form.secretValue) {
      errors.secretValue = t('secrets.errors.secretValueRequired')
      return false
    }
    return true
  }

  async function handleSubmit() {
    if (!validate()) return

    loading.value = true
    apiErrorCode.value = null
    apiErrorMessage.value = null

    try {
      if (mode === 'create') {
        const provider =
          form.provider === PROVIDER_NONE
            ? undefined
            : (form.provider as SecretProvider)
        await secretsApi.create({
          name: form.name.trim(),
          secret_value: form.secretValue,
          provider
        })
      } else if (secret) {
        const updatePayload: { name: string; secret_value?: string } = {
          name: form.name.trim()
        }
        if (form.secretValue) {
          updatePayload.secret_value = form.secretValue
        }
        await secretsApi.update(secret.id, updatePayload)
      }
      onSaved()
      visible.value = false
    } catch (err) {
      if (err instanceof SecretsApiError) {
        apiErrorCode.value = err.code ?? null
        apiErrorMessage.value = err.message
      }
    } finally {
      loading.value = false
    }
  }

  return {
    form,
    errors,
    loading,
    apiError,
    providerOptions,
    validate,
    handleSubmit,
    resetForm
  }
}
