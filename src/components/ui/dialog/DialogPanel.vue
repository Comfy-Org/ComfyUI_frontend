<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import Card from '@/components/ui/card/Card.vue'
import CardFooter from '@/components/ui/card/CardFooter.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import type { DialogPanelProps } from '@/components/ui/dialog/types'

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
        <i class="icon-[lucide--x] size-4" />
      </Button>
    </CardHeader>
    <slot />
    <CardFooter v-if="$slots.footer">
      <slot name="footer" />
    </CardFooter>
  </Card>
</template>
