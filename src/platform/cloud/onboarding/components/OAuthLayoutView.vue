<template>
  <div
    :style="oauthDuskSurfaces"
    class="dark-theme relative h-svh w-screen overflow-y-auto bg-primary-comfy-ink font-sans text-primary-comfy-canvas"
  >
    <i
      class="absolute top-6 left-6 icon-[comfy--comfy-logo] h-5 w-22 text-brand-yellow md:h-6 md:w-26"
      aria-hidden="true"
    />
    <RouterView />
  </div>
  <GlobalToast />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'

import GlobalToast from '@/components/toast/GlobalToast.vue'
import { oauthDuskSurfaces } from '@/platform/cloud/oauth/oauthDuskTheme'

onMounted(() => {
  document.getElementById('splash-loader')?.remove()
})
</script>
