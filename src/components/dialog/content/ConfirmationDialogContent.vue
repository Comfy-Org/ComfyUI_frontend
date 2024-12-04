<template>
  <section class="prompt-dialog-content flex flex-col gap-6 m-2 mt-4">
    <span>{{ message }}</span>
    <div class="flex gap-4 justify-end">
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
  </section>
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
