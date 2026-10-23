<script setup lang="ts">
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogRoot,
  DialogTitle,
  DialogTrigger
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

defineProps<{ title?: string; to?: string | HTMLElement }>()

const { t } = useI18n()
</script>
<template>
  <DialogRoot v-slot="{ close }">
    <DialogTrigger as-child>
      <slot name="button" />
    </DialogTrigger>
    <DialogPortal :to>
      <DialogOverlay
        class="fixed inset-0 z-overlay bg-black/70 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      />
      <DialogContent
        v-bind="$attrs"
        class="fixed top-[50%] left-[50%] z-overlay max-h-[85vh] w-[90vw] max-w-[450px] -translate-1/2 rounded-2xl border border-border/50 bg-background p-2 shadow-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
      >
        <div
          v-if="title"
          class="flex w-full items-center justify-between border-b border-border/50 px-4"
        >
          <DialogTitle class="text-sm">{{ title }}</DialogTitle>
          <DialogClose as-child>
            <Button
              :aria-label="t('g.close')"
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
