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

import { provideBillingClient } from '@comfyorg/account-ui/billing'

import { provideAutoTopUpSettings } from '@/session/autoTopUpSettings'
import { createModeBillingClient } from '@/session/billingWebAuth'
import { disposeBillingWebClient } from '@/session/billingWebClient'
import { provideWorkspaceInvites } from '@/session/workspaceInvites'

const client = createModeBillingClient()

provideBillingClient(client)
provideWorkspaceInvites(client.invites)
provideAutoTopUpSettings(client.autoTopUp)
onUnmounted(() => disposeBillingWebClient(client))
</script>

<template>
  <slot />
</template>
