import { whenever } from '@vueuse/core'
import type { MaybeRefOrGetter } from 'vue'
import { computed, reactive, ref, toValue } from 'vue'
import { useI18n } from 'vue-i18n'

import { createSecret, SecretsApiError, updateSecret } from '../api/secretsApi'
import {
  DEFAULT_PROVIDER_IDS,
  getProviderHelpKey,
  getProviderLabel,
  getProviderLogo
} from '../providers'
import type { SecretErrorCode, SecretMetadata } from '../types'

interface SecretFormState {
  name: string
  secretValue: string
  // Free-form string: the set of selectable providers is server-driven.
  provider: string | null
}

interface SecretFormErrors {
  name: string
  secretValue: string
  provider: string
}

interface ProviderOption {
  label: string
  value: string
  logo?: string
  disabled: boolean
}

interface UseSecretFormOptions {
  mode: 'create' | 'edit'
  secret?: MaybeRefOrGetter<SecretMetadata | undefined>
  existingProviders: MaybeRefOrGetter<string[]>
  availableProviders?: MaybeRefOrGetter<string[] | null>
  visible: { value: boolean }
  onSaved: () => void
}

export function useSecretForm(options: UseSecretFormOptions) {
  const { t } = useI18n()
  const {
    mode,
    secret: secretRef,
    existingProviders,
    availableProviders = null,
    visible,
    onSaved
  } = options

  const loading = ref(false)
  const apiErrorCode = ref<SecretErrorCode | null>(null)
  const apiErrorMessage = ref<string | null>(null)

  const form = reactive<SecretFormState>({
    name: '',
    secretValue: '',
    provider: null
  })

  const errors = reactive<SecretFormErrors>({
    name: '',
    secretValue: '',
    provider: ''
  })

  const providerOptions = computed<ProviderOption[]>(() => {
    // Which provider ids to render:
    // - edit mode: the field is disabled; show the defaults plus the stored
    //   provider so the disabled selector can display its label/logo.
    // - create + list not yet loaded (null): show the defaults as a sensible
    //   placeholder while the request is in flight.
    // - create + list loaded: render exactly what the server returned, so
    //   providers added server-side (e.g. runway/gemini) appear with no FE
    //   change and providers omitted server-side do not appear.
    const available = toValue(availableProviders)
    let ids: string[]
    if (mode === 'edit') {
      const stored = toValue(secretRef)?.provider
      ids =
        stored && !DEFAULT_PROVIDER_IDS.includes(stored as never)
          ? [...DEFAULT_PROVIDER_IDS, stored]
          : [...DEFAULT_PROVIDER_IDS]
    } else {
      ids = available === null ? [...DEFAULT_PROVIDER_IDS] : available
    }

    const existing = toValue(existingProviders)
    return ids.map((id) => ({
      value: id,
      label: getProviderLabel(id),
      logo: getProviderLogo(id),
      disabled: mode === 'edit' ? false : existing.includes(id)
    }))
  })

  // Provider-specific help text when the selected provider defines it, else the
  // generic hint. Sourced from the presentational registry, not the server.
  const providerHelp = computed(() =>
    t(getProviderHelpKey(form.provider ?? undefined) ?? 'secrets.providerHint')
  )

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
    const secret = toValue(secretRef)
    if (mode === 'edit' && secret) {
      form.name = secret.name
      form.provider = secret.provider ?? null
      form.secretValue = ''
    } else {
      form.name = ''
      form.secretValue = ''
      form.provider = null
    }
    errors.name = ''
    errors.secretValue = ''
    errors.provider = ''
    apiErrorCode.value = null
    apiErrorMessage.value = null
  }

  whenever(() => visible.value, resetForm)

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
    if (!form.provider) {
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
      const secret = toValue(secretRef)
      if (mode === 'create') {
        await createSecret({
          name: form.name.trim(),
          secret_value: form.secretValue,
          provider: form.provider!
        })
      } else if (secret) {
        const updatePayload: { name: string; secret_value?: string } = {
          name: form.name.trim()
        }
        if (form.secretValue) {
          updatePayload.secret_value = form.secretValue
        }
        await updateSecret(secret.id, updatePayload)
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
    providerHelp,
    handleSubmit
  }
}
