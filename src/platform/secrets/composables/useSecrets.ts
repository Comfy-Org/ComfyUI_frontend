import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useToastStore } from '@/platform/updates/common/toastStore'

import {
  deleteSecret as deleteSecretApi,
  listSecretProviders,
  listSecrets,
  SecretsApiError
} from '../api/secretsApi'
import { BYOK_PARTNER_PROVIDERS } from '../providers'
import type { SecretMetadata, SecretProvider } from '../types'

export function useSecrets() {
  const { t } = useI18n()
  const toastStore = useToastStore()
  const { flags } = useFeatureFlags()

  const loading = ref(false)
  const secrets = ref<SecretMetadata[]>([])
  const serverProviders = ref<string[] | null>(null)
  const operatingSecretId = ref<string | null>(null)

  const availableProviders = computed<string[] | null>(() => {
    const providers = serverProviders.value
    if (providers === null || flags.byokPartnerNodesEnabled) return providers
    return providers.filter((p) => !BYOK_PARTNER_PROVIDERS.has(p))
  })

  const existingProviders = computed<SecretProvider[]>(() =>
    secrets.value
      .map((s) => s.provider)
      .filter((p): p is SecretProvider => p !== undefined)
  )

  async function fetchSecrets() {
    loading.value = true
    try {
      secrets.value = await listSecrets()
    } catch (err) {
      if (err instanceof SecretsApiError) {
        toastStore.add({
          severity: 'error',
          summary: t('g.error'),
          detail: err.message
        })
      } else {
        console.error('Unexpected error fetching secrets:', err)
        toastStore.add({
          severity: 'error',
          summary: t('g.error'),
          detail: t('g.unknownError')
        })
      }
    } finally {
      loading.value = false
    }
  }

  async function fetchProviders() {
    try {
      serverProviders.value = await listSecretProviders()
    } catch (err) {
      console.error('Unexpected error fetching secret providers:', err)
    }
  }

  async function deleteSecret(secret: SecretMetadata) {
    operatingSecretId.value = secret.id
    try {
      await deleteSecretApi(secret.id)
      secrets.value = secrets.value.filter((s) => s.id !== secret.id)
    } catch (err) {
      if (err instanceof SecretsApiError) {
        toastStore.add({
          severity: 'error',
          summary: t('g.error'),
          detail: err.message
        })
      } else {
        console.error('Unexpected error deleting secret:', err)
        toastStore.add({
          severity: 'error',
          summary: t('g.error'),
          detail: t('g.unknownError')
        })
      }
    } finally {
      operatingSecretId.value = null
    }
  }

  return {
    loading,
    secrets,
    availableProviders,
    operatingSecretId,
    existingProviders,
    fetchSecrets,
    fetchProviders,
    deleteSecret
  }
}
