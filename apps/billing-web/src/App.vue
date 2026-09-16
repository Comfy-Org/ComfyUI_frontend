<script setup lang="ts">
import { computed } from 'vue'

import BillingShell from '@/components/BillingShell.vue'
import { useBillingWebSession } from '@/session/billingWebSession'

const { session } = useBillingWebSession()

/** A new key is a new scope, so the shell remounts with a fresh client. */
const scopeKey = computed(() =>
  session.value
    ? `${session.value.uid}:${session.value.workspace.id}`
    : undefined
)
</script>

<template>
  <BillingShell v-if="scopeKey" :key="scopeKey">
    <RouterView />
  </BillingShell>
  <RouterView v-else />
</template>
