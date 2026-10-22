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
    :class="
      cn(
        'flex items-center gap-2',
        href &&
          'underline underline-offset-4 hover:text-primary-comfy-yellow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-comfy-yellow'
      )
    "
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
