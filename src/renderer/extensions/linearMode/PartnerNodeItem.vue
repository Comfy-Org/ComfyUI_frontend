<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { CREDITS_ICON } from '@/base/credits/comfyCredits'

defineProps<{ title: string; price: string }>()
</script>
<template>
  <li class="col-span-2 grid grid-cols-subgrid items-center text-xs/4.5">
    <span class="line-clamp-2 min-w-0 wrap-break-word" v-text="title" />
    <span
      class="inline-flex shrink-0 items-center gap-1 justify-self-end rounded-full bg-current/15 px-1.5 py-1 text-xs leading-none font-medium"
    >
      <i :class="cn(CREDITS_ICON, 'size-3 shrink-0 bg-current')" />
      {{ price }}
    </span>
  </li>
</template>
