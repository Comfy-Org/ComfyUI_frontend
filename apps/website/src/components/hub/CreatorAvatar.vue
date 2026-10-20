<script setup lang="ts">
const { name, avatarUrl } = defineProps<{
  name: string
  avatarUrl?: string
}>()
</script>

<template>
  <img
    v-if="avatarUrl"
    :src="avatarUrl"
    alt=""
    class="shrink-0 rounded-full object-cover"
  />
  <span
    v-else
    class="grid shrink-0 place-items-center rounded-full bg-brand font-bold text-page"
    aria-hidden="true"
  >
    {{ name.charAt(0).toUpperCase() }}
  </span>
</template>
