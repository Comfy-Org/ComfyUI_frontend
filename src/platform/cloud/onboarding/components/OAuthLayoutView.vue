<template>
  <!-- Minimal standalone layout for OAuth flows — no app chrome -->
  <RouterView />
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
