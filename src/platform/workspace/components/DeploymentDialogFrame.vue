<template>
  <div
    :class="
      cn(
        '@container',
        wide
          ? 'w-[min(680px,calc(100vw-2rem))]'
          : 'w-[min(640px,calc(100vw-2rem))]'
      )
    "
  >
    <div
      v-bind="$attrs"
      class="relative max-h-[85dvh] overflow-y-auto rounded-2xl border bg-background shadow-2xl"
    >
      <Button
        variant="muted-textonly"
        size="icon"
        :aria-label="$t('g.close')"
        class="absolute top-3 right-3 z-20"
        @click="emit('dismiss')"
      >
        <i class="icon-[lucide--x]" />
      </Button>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import Button from '@comfyorg/design-system/button/Button'

defineOptions({ inheritAttrs: false })

const { wide = false } = defineProps<{
  wide?: boolean
}>()

const emit = defineEmits<{
  dismiss: []
}>()
</script>
