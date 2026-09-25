<script setup lang="ts">
import { computed } from 'vue'

import BillingShell from '@/components/BillingShell.vue'
import { useBillingEntry } from '@/entry/billingEntry'
import { billedScope } from '@/session/billingWebAuth'
import EntryErrorView from '@/views/EntryErrorView.vue'

const { error } = useBillingEntry()

/** A new key is a new scope, so the shell remounts with a fresh client. */
const scopeKey = computed(() =>
  billedScope.value
    ? `${billedScope.value.uid}:${billedScope.value.workspace.id}`
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
