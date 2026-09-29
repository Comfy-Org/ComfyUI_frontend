<script setup lang="ts">
/**
 * Owns the billing client's lifetime. The composables never dispose what they
 * are handed, so the scope end — sign-out, an account or workspace switch —
 * has to be this component's unmount: `App.vue` keys the shell by scope, so a
 * switch builds a fresh client and the previous one is disposed rather than
 * going on serving the previous account's balance, capabilities, status,
 * plans and saved cards.
 */
import { onUnmounted } from 'vue'

import {
  disposeBillingClient,
  provideBillingClient
} from '@comfyorg/account-ui/billing'

import { createModeBillingClient } from '@/session/billingWebAuth'

const client = createModeBillingClient()

provideBillingClient(client)
onUnmounted(() => disposeBillingClient(client))
</script>

<template>
  <slot />
</template>
