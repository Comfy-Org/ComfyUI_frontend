<script setup lang="ts">
import { COMING_SOON_APPS } from '../../lib/workshop/coming-soon-apps'

defineProps<{ label: string }>()
</script>

<template>
  <div class="mt-4 flex flex-wrap items-center gap-2">
    <span class="mr-1 text-sm text-content-secondary">{{ label }}</span>
    <span
      v-for="name in COMING_SOON_APPS"
      :key="name"
      class="rounded-full border border-transparency-white-t8 px-3 py-1 text-sm text-content-secondary"
    >
      {{ name }}
    </span>
  </div>
</template>
