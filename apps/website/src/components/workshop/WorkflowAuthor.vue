<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { UserRound } from '@lucide/vue'
const { name, avatar, href } = defineProps<{
  name: string
  avatar?: string
  href?: string
}>()
</script>
<template>
  <component
    :is="href ? 'a' : 'span'"
    :href
    :class="cn('flex items-center gap-2', href && 'hover:underline')"
    data-testid="workflow-author"
  >
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
  </component>
</template>
