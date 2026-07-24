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
  SecretCredentialOption,
  SecretCredentialType,
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
  // Which credential class the user is entering. Null when the selected provider
  // advertises no options, in which case `credential_type` is omitted on create
  // and the server applies its own default.
  const credentialType = ref<SecretCredentialType | null>(null)

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
  // the selected provider's input type can look up their `label` /
  // `credential_options`.
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

  // The credential-entry options the server advertises for the selected
  // provider. Empty means a single implicit api_key/text credential (the common
  // case), so callers render no sub-selection.
  const credentialOptions = computed<SecretCredentialOption[]>(() => {
    if (!form.provider) return []
    return providerInfoById.value.get(form.provider)?.credential_options ?? []
  })

  // How the selected provider's credential is entered: the selected credential
  // class wins; otherwise the provider's first advertised option; otherwise a
  // single-line secret.
  //
  // Edit mode intentionally follows the same path here. Deriving the input from
  // the *stored* credential class (which the server treats as immutable on
  // update) is tracked separately.
  const selectedInputType = computed<SecretInputType>(() => {
    const options = credentialOptions.value
    if (!options.length) return 'text'
    const selected = options.find(
      (o) => o.credential_type === credentialType.value
    )
    return (selected ?? options[0]).input_type
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

  // Bumped whenever a read is started or invalidated (by a provider change or a
  // form reset), so a slow read that resolves after the user has moved on is
  // discarded instead of overwriting the current field.
  let latestFileReadId = 0

  function clearSecretValue() {
    form.secretValue = ''
    fileName.value = ''
  }

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
    credentialType.value = defaultCredentialType()
    errors.name = ''
    errors.secretValue = ''
    errors.provider = ''
    apiErrorCode.value = null
    apiErrorMessage.value = null
    latestFileReadId++
  }

  async function loadSecretFromFile(file: File | null) {
    if (!file) return
    // Invalidate any in-flight read up front so a slower earlier read can't
    // resolve later and overwrite the outcome of this selection.
    const readId = ++latestFileReadId
    errors.secretValue = ''
    if (file.size >= MAX_JSON_FILE_BYTES) {
      clearSecretValue()
      errors.secretValue = t('secrets.errors.fileTooLarge')
      return
    }
    try {
      const text = await file.text()
      if (readId !== latestFileReadId) return
      form.secretValue = text
      fileName.value = file.name
    } catch {
      if (readId !== latestFileReadId) return
      clearSecretValue()
      errors.secretValue = t('secrets.errors.fileReadFailed')
    }
  }

  // The credential class to preselect for the current provider: its first
  // advertised option, or null when it advertises none.
  function defaultCredentialType(): SecretCredentialType | null {
    return credentialOptions.value[0]?.credential_type ?? null
  }

  // Switching providers discards any entered or uploaded credential so a value
  // captured for one provider (e.g. an uploaded JSON key) can't be submitted
  // under another, invalidates any in-flight file read, and preselects the new
  // provider's default credential class.
  watch(
    () => form.provider,
    () => {
      latestFileReadId++
      clearSecretValue()
      errors.secretValue = ''
      credentialType.value = defaultCredentialType()
    }
  )

  // Switching credential class within one provider must also discard the value:
  // an uploaded service-account JSON must never be submittable as an api_key
  // (or vice versa), since the class determines both the upstream and how the
  // server validates the value.
  watch(credentialType, () => {
    latestFileReadId++
    clearSecretValue()
  })

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
    if (selectedInputType.value === 'json_file' && form.secretValue) {
      // Guard the size cap for pasted content too, so an arbitrarily large
      // string can't block the main thread on JSON.parse below.
      if (form.secretValue.length >= MAX_JSON_FILE_BYTES) {
        errors.secretValue = t('secrets.errors.fileTooLarge')
        return false
      }
      if (!isJsonObject(form.secretValue)) {
        errors.secretValue = t('secrets.errors.invalidJson')
        return false
      }
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
        // `credential_type` is sent only when the provider advertises options.
        // Omitting it for single-credential providers keeps the payload
        // byte-identical to before for huggingface/civitai/runway.
        await createSecret({
          name: form.name.trim(),
          secret_value: form.secretValue,
          provider: form.provider!,
          ...(credentialType.value
            ? { credential_type: credentialType.value }
            : {})
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
    credentialOptions,
    credentialType,
    fileName,
    loadSecretFromFile,
    handleSubmit
  }
}
