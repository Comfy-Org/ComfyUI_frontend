<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import BillingShell from '@/components/BillingShell.vue'
import { useBillingEntry } from '@/entry/billingEntry'
import { SIGN_IN_PATH } from '@/router'
import { useBillingWebSession } from '@/session/billingWebSession'
import EntryErrorView from '@/views/EntryErrorView.vue'

const { error } = useBillingEntry()
const { phase, session } = useBillingWebSession()
const route = useRoute()
const router = useRouter()

/**
 * The router guard only runs on navigation, so a session refused after the
 * page rendered (a restored credential for a workspace that has since been
 * deleted) is sent to sign-in here, where the refusal is explained.
 */
watch(phase, (next) => {
  if (next !== 'error' || route.path === SIGN_IN_PATH) return
  void router.replace({
    path: SIGN_IN_PATH,
    query: { returnTo: route.fullPath }
  })
})

/** A new key is a new scope, so the shell remounts with a fresh client. */
const scopeKey = computed(() =>
  session.value
    ? `${session.value.uid}:${session.value.workspace.id}`
    : undefined
)
</script>

<template>
  <!-- An entry error outranks the session: no account repairs a bad link. -->
  <EntryErrorView v-if="error" />
  <BillingShell v-else-if="scopeKey" :key="scopeKey">
    <RouterView />
  </BillingShell>
  <RouterView v-else />
</template>
