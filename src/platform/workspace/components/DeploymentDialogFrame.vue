<template>
  <div :class="cn('@container', FRAME_WIDTH[size])">
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
import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

defineOptions({ inheritAttrs: false })

type DialogFrameSize = 'narrow' | 'default' | 'wide'

const FRAME_WIDTH: Record<DialogFrameSize, string> = {
  narrow: 'w-[min(480px,calc(100vw-2rem))]',
  default: 'w-[min(640px,calc(100vw-2rem))]',
  wide: 'w-[min(1040px,calc(100vw-2rem))]'
}

const { size = 'default' } = defineProps<{
  size?: DialogFrameSize
}>()

const emit = defineEmits<{
  dismiss: []
}>()
</script>
