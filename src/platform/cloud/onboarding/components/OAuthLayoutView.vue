<template>
  <div
    class="dark-theme h-svh w-screen overflow-y-auto bg-primary-comfy-ink font-sans text-primary-comfy-canvas"
  >
    <RouterView />
  </div>
  <GlobalToast />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'

import GlobalToast from '@/components/toast/GlobalToast.vue'

onMounted(() => {
  document.getElementById('splash-loader')?.remove()
})
</script>
