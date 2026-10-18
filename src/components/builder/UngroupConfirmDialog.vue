<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogClose from '@/components/ui/dialog/DialogClose.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogOverlay from '@/components/ui/dialog/DialogOverlay.vue'
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ confirm: [] }>()
const { t } = useI18n()

function handleConfirm() {
  emit('confirm')
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogPortal>
      <DialogOverlay />
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{{ t('linearMode.groups.confirmUngroup') }}</DialogTitle>
          <DialogClose />
        </DialogHeader>
        <DialogDescription class="px-4 py-2">
          {{ t('linearMode.groups.ungroupDescription') }}
        </DialogDescription>
        <DialogFooter>
          <DialogClose>
            <Button variant="secondary">{{ t('g.cancel') }}</Button>
          </DialogClose>
          <Button variant="primary" @click="handleConfirm">
            {{ t('linearMode.groups.ungroup') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>
