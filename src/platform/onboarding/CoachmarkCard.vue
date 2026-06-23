<template>
  <div
    :class="
      cn(
        'flex w-full flex-col items-start justify-center gap-3 rounded-2xl bg-secondary-background p-4 drop-shadow-[1px_1px_8px_rgba(0,0,0,0.4)]',
        elevated && 'ring-1 ring-border-default'
      )
    "
  >
    <div
      v-if="image || $slots.image"
      class="flex h-[146px] flex-col items-start justify-center gap-4 self-stretch overflow-hidden rounded-xl bg-base-background"
    >
      <slot name="image">
        <img v-if="image" :src="image" alt="" class="size-full object-cover" />
      </slot>
    </div>
    <div class="flex flex-col items-end justify-end gap-6 self-stretch">
      <div class="flex flex-col items-start gap-2 self-stretch">
        <p v-if="subtitle" class="m-0 text-xs/normal text-base-foreground">
          {{ subtitle }}
        </p>
        <h3 class="m-0 text-base/normal font-semibold text-base-foreground">
          {{ title }}
        </h3>
        <p :id="messageId" class="m-0 text-sm/normal text-muted-foreground">
          {{ message }}
        </p>
      </div>
      <div v-if="$slots.actions" class="flex items-center gap-3">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const { title, message, subtitle, image, messageId, elevated } = defineProps<{
  title: string
  message: string
  subtitle?: string
  image?: string
  messageId?: string
  elevated?: boolean
}>()
</script>
