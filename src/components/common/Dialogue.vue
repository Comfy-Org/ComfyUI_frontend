<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
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
        class="data-[state=open]:animate-overlayShow fixed inset-0 z-30 bg-black/70"
      />
      <DialogContent
        v-bind="$attrs"
        class="data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] z-1700 max-h-[85vh] w-[90vw] max-w-[450px] translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-border-subtle bg-base-background p-2 shadow-sm"
      >
        <div
          v-if="title"
          class="flex w-full items-center justify-between border-b border-border-subtle px-4"
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
