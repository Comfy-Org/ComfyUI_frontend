<script setup lang="ts">
import { UserRound } from '@lucide/vue'
const { name, avatar } = defineProps<{ name: string; avatar?: string }>()
</script>
<template>
  <span class="flex items-center gap-2">
    <img
      v-if="avatar"
      :src="avatar"
      alt=""
      class="size-6 shrink-0 rounded-full object-cover"
      referrerpolicy="no-referrer"
      data-testid="workflow-author-avatar"
    />
    <UserRound
      v-else
      class="size-6 shrink-0 text-primary-warm-gray"
      aria-hidden="true"
    />
    <span class="truncate">{{ name }}</span>
  </span>
</template>
