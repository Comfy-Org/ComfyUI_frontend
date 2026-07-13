import { whenever } from '@vueuse/core'
import type { MaybeRefOrGetter } from 'vue'
import { computed, reactive, ref, toValue, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { createSecret, SecretsApiError, updateSecret } from '../api/secretsApi'
import {
  DEFAULT_PROVIDER_IDS,
  getProviderHelpKey,
  getProviderLabel,
  getProviderLogo
} from '../providers'
import type {
  SecretErrorCode,
  SecretInputType,
  SecretMetadata,
  SecretProviderInfo
} from '../types'

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

// A json_file credential (e.g. a Vertex service-account key) must be a JSON
// object, so scalars and arrays are rejected even though they parse.
function isJsonObject(value: string): boolean {
  try {
    const parsed: unknown = JSON.parse(value)
    return (
      typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    )
  } catch {
    return false
  }
}

// Service-account keys are only a few KB; cap uploads well above that so a huge
// file can't be read into memory or block the main thread on JSON.parse.
const MAX_JSON_FILE_BYTES = 1024 * 1024

interface UseSecretFormOptions {
  mode: 'create' | 'edit'
  secret?: MaybeRefOrGetter<SecretMetadata | undefined>
  existingProviders: MaybeRefOrGetter<string[]>
  availableProviders?: MaybeRefOrGetter<SecretProviderInfo[] | null>
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
  // Name of the uploaded credential file (json_file providers), for display.
  const fileName = ref('')

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

  // The server-returned provider metadata keyed by id, so option rendering and
  // the selected provider's input type can look up their `label`/`input_type`.
  const providerInfoById = computed(() => {
    const map = new Map<string, SecretProviderInfo>()
    for (const info of toValue(availableProviders) ?? []) map.set(info.id, info)
    return map
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
        stored && !DEFAULT_PROVIDER_IDS.some((id) => id === stored)
          ? [...DEFAULT_PROVIDER_IDS, stored]
          : [...DEFAULT_PROVIDER_IDS]
    } else {
      ids =
        available === null
          ? [...DEFAULT_PROVIDER_IDS]
          : [...new Set(available.map((p) => p.id))]
    }

    const existing = toValue(existingProviders)
    return ids.map((id) => ({
      value: id,
      label: providerInfoById.value.get(id)?.label ?? getProviderLabel(id),
      logo: getProviderLogo(id),
      disabled: mode === 'edit' ? false : existing.includes(id)
    }))
  })

  // How the selected provider's credential is entered. Providers omitting
  // `input_type` (and any unlisted selection) default to a single-line secret.
  const selectedInputType = computed<SecretInputType>(() => {
    if (!form.provider) return 'text'
    return providerInfoById.value.get(form.provider)?.input_type ?? 'text'
  })

  // Once the server allowlist resolves, drop a selection the resolved list no
  // longer offers so the user cannot submit an unlisted provider.
  watch(providerOptions, (resolvedOptions) => {
    if (
      form.provider &&
      !resolvedOptions.some((o) => o.value === form.provider)
    ) {
      form.provider = null
    }
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
    fileName.value = ''
    errors.name = ''
    errors.secretValue = ''
    errors.provider = ''
    apiErrorCode.value = null
    apiErrorMessage.value = null
  }

  // Bumped whenever a read is started or invalidated (by a provider change), so
  // a slow read that resolves after the user has moved on is discarded instead
  // of overwriting the current field.
  let latestFileReadId = 0

  async function loadSecretFromFile(file: File | null) {
    if (!file) return
    errors.secretValue = ''
    if (file.size > MAX_JSON_FILE_BYTES) {
      errors.secretValue = t('secrets.errors.fileTooLarge')
      return
    }
    const readId = ++latestFileReadId
    try {
      const text = await file.text()
      if (readId !== latestFileReadId) return
      form.secretValue = text
      fileName.value = file.name
    } catch {
      if (readId !== latestFileReadId) return
      errors.secretValue = t('secrets.errors.fileReadFailed')
    }
  }

  // Switching providers discards any entered or uploaded credential so a value
  // captured for one provider (e.g. an uploaded JSON key) can't be submitted
  // under another, and invalidates any in-flight file read.
  watch(
    () => form.provider,
    () => {
      latestFileReadId++
      form.secretValue = ''
      fileName.value = ''
    }
  )

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
    if (
      selectedInputType.value === 'json_file' &&
      form.secretValue &&
      !isJsonObject(form.secretValue)
    ) {
      errors.secretValue = t('secrets.errors.invalidJson')
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
    selectedInputType,
    fileName,
    loadSecretFromFile,
    handleSubmit
  }
}
