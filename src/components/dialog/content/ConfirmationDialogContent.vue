<template>
  <div class="prompt-dialog-content flex flex-col gap-2 pt-8">
    <p class="m-2">
      <span>{{ message }}</span>
    </p>
    <div class="flex gap-4 m-2 justify-end">
      <Button
        :label="$t('cancel')"
        icon="pi pi-undo"
        severity="secondary"
        @click="onCancel"
        autofocus
      />
      <Button
        v-if="type === 'delete'"
        :label="$t('delete')"
        severity="danger"
        @click="onConfirm"
        icon="pi pi-trash"
      />
      <Button
        v-else
        :label="$t('overwrite')"
        severity="warn"
        @click="onConfirm"
        icon="pi pi-save"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { useDialogStore } from '@/stores/dialogStore'

const props = defineProps<{
  message: string
  type: 'overwrite' | 'delete'
  onConfirm: (value?: boolean) => void
}>()

const onCancel = () => useDialogStore().closeDialog()

const onConfirm = () => {
  props.onConfirm(true)
  useDialogStore().closeDialog()
}
</script>
