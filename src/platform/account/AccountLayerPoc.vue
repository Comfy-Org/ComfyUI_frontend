<template>
  <aside
    v-if="enabled && credits.phase !== 'idle' && credits.phase !== 'empty'"
    class="fixed right-4 bottom-4 z-50 rounded-lg bg-comfy-menu-bg p-3"
    data-testid="account-layer-poc"
  >
    <CreditsDisplay source="props" :state="credits" />
  </aside>
</template>

<script setup lang="ts">
import { CreditsDisplay, useCredits } from '@comfyorg/account/vue'

const enabled = import.meta.env.VITE_ACCOUNT_LAYER_POC === 'true'
const credits = useCredits()
</script>
