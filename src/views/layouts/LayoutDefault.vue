<template>
  <main class="relative h-full w-full overflow-hidden">
    <router-view />
  </main>
</template>

<script setup lang="ts">
import { useFavicon } from '@vueuse/core'

useFavicon('/assets/favicon.ico')
</script>
