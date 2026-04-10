<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  confirm: []
}>()

const { t } = useI18n()

function handleConfirm() {
  emit('confirm')
  open.value = false
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-1800 bg-black/50" />
      <DialogContent
        class="fixed top-1/2 left-1/2 z-1800 w-80 -translate-1/2 rounded-xl border border-border-subtle bg-base-background p-5 shadow-lg"
      >
        <div class="flex items-center justify-between">
          <DialogTitle class="text-sm font-medium">
            {{ t('linearMode.groups.confirmUngroup') }}
          </DialogTitle>
          <DialogClose
            class="flex size-6 items-center justify-center rounded-sm border-0 bg-transparent text-muted-foreground outline-none hover:text-base-foreground"
          >
            <i class="icon-[lucide--x] size-4" />
          </DialogClose>
        </div>
        <div
          class="mt-3 border-t border-border-subtle pt-3 text-sm text-muted-foreground"
        >
          {{ t('linearMode.groups.ungroupDescription') }}
        </div>
        <div class="mt-5 flex items-center justify-end gap-3">
          <DialogClose as-child>
            <Button variant="muted-textonly" size="sm">
              {{ t('g.cancel') }}
            </Button>
          </DialogClose>
          <Button variant="secondary" size="lg" @click="handleConfirm">
            {{ t('linearMode.groups.ungroup') }}
          </Button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
