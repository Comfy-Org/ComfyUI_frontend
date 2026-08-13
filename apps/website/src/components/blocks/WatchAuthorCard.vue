<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

const {
  name,
  detail,
  avatar,
  class: className
} = defineProps<{
  name: string
  detail?: string
  avatar?: string
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div :class="cn('flex items-center gap-6', className)">
    <img
      v-if="avatar"
      :src="avatar"
      alt=""
      loading="lazy"
      decoding="async"
      class="size-19 shrink-0 rounded-full object-cover"
    />
    <div class="flex flex-col gap-2">
      <p
        class="text-primary-warm-white text-sm font-extrabold tracking-wider uppercase"
      >
        {{ name }}
      </p>
      <p
        v-if="detail"
        class="text-primary-warm-gray text-sm font-extrabold tracking-wider uppercase"
      >
        {{ detail }}
      </p>
    </div>
  </div>
</template>
