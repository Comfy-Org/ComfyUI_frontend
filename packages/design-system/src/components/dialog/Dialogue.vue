<script setup lang="ts">
import DialogClose from '@comfyorg/design-system/dialog/DialogClose'
import DialogContent from '@comfyorg/design-system/dialog/DialogContent'
import DialogOverlay from '@comfyorg/design-system/dialog/DialogOverlay'
import DialogPortal from '@comfyorg/design-system/dialog/DialogPortal'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import { DialogRoot, DialogTrigger } from 'reka-ui'

import Button from '@comfyorg/design-system/button/Button'

defineProps<{
  title?: string
  closeLabel: string
  to?: string | HTMLElement
}>()
</script>
<template>
  <DialogRoot v-slot="{ close }">
    <DialogTrigger as-child>
      <slot name="button" />
    </DialogTrigger>
    <DialogPortal :to>
      <DialogOverlay />
      <DialogContent v-bind="$attrs" size="sm" class="p-2">
        <div
          v-if="title"
          class="flex w-full items-center justify-between border-b border-border/50 px-4"
        >
          <DialogTitle class="text-sm">{{ title }}</DialogTitle>
          <DialogClose>
            <Button
              :aria-label="closeLabel"
              size="icon"
              variant="muted-textonly"
            >
              <i class="icon-[lucide--x]" />
            </Button>
          </DialogClose>
        </div>
        <slot :close />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
