<template>
  <WorkspaceAuthGate>
    <main class="relative h-full w-full overflow-hidden">
      <router-view />
    </main>
  </WorkspaceAuthGate>
</template>

<script setup lang="ts">
import { useFavicon } from '@vueuse/core'

import WorkspaceAuthGate from '@/components/auth/WorkspaceAuthGate.vue'

useFavicon('/assets/favicon.ico')
</script>
