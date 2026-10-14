<script setup lang="ts">
import WorkshopCardMaker from './WorkshopCardMaker.vue'

const { label, logo } = defineProps<{
  label: string
  logo: string | null
}>()
</script>

<template>
  <WorkshopCardMaker
    :label
    :logo
    class="pointer-events-none absolute top-4 right-4 z-10 h-7 max-w-[calc(100%-5rem)] rounded-lg bg-black/45 px-2 text-2xs font-semibold text-white backdrop-blur-md"
  />
</template>
