<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { billingIntentPath } from '@comfyorg/billing-contract'

import { safeReturnTo } from '@/auth/returnTo'
import BillingShell from '@/components/BillingShell.vue'
import { useBillingEntry } from '@/entry/billingEntry'
import { SIGN_IN_PATH } from '@/router'
import { billedScope, billingWebLivePhase } from '@/session/billingWebAuth'
import EntryErrorView from '@/views/EntryErrorView.vue'

const { error } = useBillingEntry()
const route = useRoute()
const router = useRouter()

/**
 * The router guard only runs on navigation, so a session refused after the
 * page rendered (a restored credential for a workspace that has since been
 * deleted) is sent to sign-in here, where the refusal is explained.
 */
watch(billingWebLivePhase, (next) => {
  if (next !== 'error' || route.path === SIGN_IN_PATH) return
  void router.replace({
    path: SIGN_IN_PATH,
    query: { returnTo: route.fullPath }
  })
})

/**
 * A checkout link that cannot be read is the checkout's own 404 on the full
 * page, so that route decides how to explain it once the variant is known,
 * which takes a signed-in session; every other unreadable link is explained
 * here, before any session. On the sign-in page the link is the one it will
 * return to.
 */
const CHECKOUT_PATH = billingIntentPath('checkout')
const checkoutLink = computed(() => {
  const path =
    route.path === SIGN_IN_PATH
      ? safeReturnTo(route.query.returnTo).split('?')[0]
      : route.path
  return path === CHECKOUT_PATH
})

/** A new key is a new scope, so the shell remounts with a fresh client. */
const scopeKey = computed(() =>
  billedScope.value
    ? `${billedScope.value.uid}:${billedScope.value.workspace.id}`
    : undefined
)
</script>

<template>
  <!-- An entry error outranks the session: no account repairs a bad link. -->
  <EntryErrorView v-if="error && !checkoutLink" />
  <BillingShell v-else-if="scopeKey" :key="scopeKey">
    <RouterView />
  </BillingShell>
  <RouterView v-else />
</template>
