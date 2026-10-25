<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import Button from '@comfyorg/design-system/button/Button'
import Card from '@comfyorg/design-system/card/Card'
import CardFooter from '@comfyorg/design-system/card/CardFooter'
import CardHeader from '@comfyorg/design-system/card/CardHeader'
import DialogTitle from './DialogTitle.vue'
import type { DialogPanelProps } from './types'

const {
  class: className,
  onClose,
  closeLabel
} = defineProps<DialogPanelProps>()
</script>

<template>
  <Card :class="cn('flex flex-col shadow-lg', className)">
    <CardHeader>
      <DialogTitle class="m-0 flex items-center gap-2 text-sm font-normal">
        <slot name="title" />
      </DialogTitle>
      <Button
        v-if="onClose"
        size="icon"
        variant="muted-textonly"
        :aria-label="closeLabel"
        @click="onClose"
      >
        <i class="icon-[lucide--x]" />
      </Button>
    </CardHeader>
    <slot />
    <CardFooter v-if="$slots.footer">
      <slot name="footer" />
    </CardFooter>
  </Card>
</template>
