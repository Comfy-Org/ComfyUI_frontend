<template>
  <aside
    v-if="enabled"
    class="fixed right-4 bottom-4 z-50 rounded-lg bg-comfy-menu-bg p-3"
    data-testid="account-layer-poc"
  >
    <CreditsDisplay source="provider" />
  </aside>
</template>

<script setup lang="ts">
import { CreditsDisplay } from '@comfyorg/account/vue'

const enabled = import.meta.env.VITE_ACCOUNT_LAYER_POC === 'true'
</script>
