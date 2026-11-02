<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Dialog from '@comfyorg/design-system/dialog/Dialog'
import DialogClose from '@comfyorg/design-system/dialog/DialogClose'
import DialogContent from '@comfyorg/design-system/dialog/DialogContent'
import DialogDescription from '@comfyorg/design-system/dialog/DialogDescription'
import DialogFooter from '@comfyorg/design-system/dialog/DialogFooter'
import DialogHeader from '@comfyorg/design-system/dialog/DialogHeader'
import DialogOverlay from '@comfyorg/design-system/dialog/DialogOverlay'
import DialogPortal from '@comfyorg/design-system/dialog/DialogPortal'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'

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
