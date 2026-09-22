<script setup lang="ts">
import { computed } from 'vue'

import BillingShell from '@/components/BillingShell.vue'
import { useBillingEntry } from '@/entry/billingEntry'
import { useBillingWebSession } from '@/session/billingWebSession'
import EntryErrorView from '@/views/EntryErrorView.vue'

const { error } = useBillingEntry()
const { session } = useBillingWebSession()

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
