<script setup lang="ts">
import {
  createBillingClient,
  createSessionClient
} from '@comfyorg/account/core'
import type { SessionState } from '@comfyorg/account/core'
import { createFirebaseIdentity } from '@comfyorg/account/firebase'
import { CreditsDisplay } from '@comfyorg/account/vue'
import { onUnmounted, ref } from 'vue'

import { createWebsiteAccountHostAdapter } from './accountHostAdapter'

const cloudUrl =
  import.meta.env.PUBLIC_CLOUD_BASE_URL || 'https://cloud.comfy.org'
const identity = createFirebaseIdentity({
  options: {
    apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
    authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
    appId: import.meta.env.PUBLIC_FIREBASE_APP_ID
  },
  persistence: 'local'
})
const workspaceId = ref<string | null>(null)
const adapter = createWebsiteAccountHostAdapter(
  cloudUrl,
  () => workspaceId.value
)
const session = createSessionClient(adapter, identity)
const billing = createBillingClient(session, adapter)
const sessionState = ref<SessionState>(session.getState())
const unsubscribe = session.subscribe((state) => {
  sessionState.value = state
})

onUnmounted(() => {
  unsubscribe()
  billing.dispose()
  identity.dispose()
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
