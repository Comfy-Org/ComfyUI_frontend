<script setup lang="ts">
import {
  createBillingClient,
  createSessionClient
} from '@comfyorg/account/core'
import type { IdentitySnapshot, SessionState } from '@comfyorg/account/core'
import { CreditsDisplay } from '@comfyorg/account/vue'
import { onUnmounted, ref } from 'vue'

import { createWebsiteAccountHostAdapter } from './accountHostAdapter'

const cloudUrl =
  import.meta.env.PUBLIC_CLOUD_BASE_URL || 'https://cloud.comfy.org'
const identity = ref<IdentitySnapshot | null>(null)
const workspaceId = ref<string | null>(null)
const adapter = createWebsiteAccountHostAdapter(
  cloudUrl,
  () => identity.value,
  () => workspaceId.value
)
const session = createSessionClient(adapter)
const billing = createBillingClient(session, adapter)
const sessionState = ref<SessionState>(session.getState())
const unsubscribe = session.subscribe((state) => {
  sessionState.value = state
})

onUnmounted(() => {
  unsubscribe()
  billing.dispose()
})
</script>

<template>
  <aside data-account-layer-poc>
    <p>Account: {{ sessionState.phase }}</p>
    <p>
      Credits:
      <CreditsDisplay source="provider" :provider="billing" />
    </p>
    <a :href="`${cloudUrl}/login`"> Sign in to Comfy Cloud </a>
  </aside>
</template>
