import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  deleteCredential,
  listCredentials,
  upsertCredential
} from '../api/modelDownloadApi'
import type { HostCredentialUpsert, HostCredentialView } from '../types'

function normalizeHost(host: string): string {
  return host.trim().toLowerCase()
}

export const useDownloadCredentialsStore = defineStore(
  'downloadCredentials',
  () => {
    const credentials = ref<HostCredentialView[]>([])
    const isLoading = ref(false)

    const credentialsByHost = computed(
      () => new Map(credentials.value.map((c) => [c.host, c]))
    )

    async function fetchCredentials() {
      isLoading.value = true
      try {
        credentials.value = await listCredentials()
      } finally {
        isLoading.value = false
      }
    }

    async function upsert(
      body: HostCredentialUpsert
    ): Promise<HostCredentialView> {
      const view = await upsertCredential({
        ...body,
        host: normalizeHost(body.host)
      })
      const index = credentials.value.findIndex((c) => c.id === view.id)
      credentials.value =
        index === -1
          ? [...credentials.value, view]
          : credentials.value.map((c) => (c.id === view.id ? view : c))
      return view
    }

    async function remove(id: string) {
      await deleteCredential(id)
      credentials.value = credentials.value.filter((c) => c.id !== id)
    }

    function enabledCredentialForHost(
      host: string
    ): HostCredentialView | undefined {
      const credential = credentialsByHost.value.get(normalizeHost(host))
      return credential?.enabled ? credential : undefined
    }

    return {
      credentials,
      isLoading,
      fetchCredentials,
      upsert,
      remove,
      enabledCredentialForHost
    }
  }
)
