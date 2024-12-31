<template>
  <section class="prompt-dialog-content flex flex-col gap-6 m-2 mt-4">
    <span>{{ message }}</span>
    <ul v-if="itemList?.length" class="pl-4 m-0 flex flex-col gap-2">
      <li v-for="item of itemList" :key="item">{{ item }}</li>
    </ul>
    <div class="flex gap-4 justify-end">
      <Button
        :label="$t('g.cancel')"
        icon="pi pi-undo"
        severity="secondary"
        @click="onCancel"
        autofocus
      />
      <Button
        v-if="type === 'default'"
        :label="$t('g.confirm')"
        severity="primary"
        @click="onConfirm"
        icon="pi pi-check"
      />
      <Button
        v-else-if="type === 'delete'"
        :label="$t('g.delete')"
        severity="danger"
        @click="onConfirm"
        icon="pi pi-trash"
      />
      <Button
        v-else-if="type === 'overwrite'"
        :label="$t('g.overwrite')"
        severity="warn"
        @click="onConfirm"
        icon="pi pi-save"
      />
      <template v-else-if="type === 'dirtyClose'">
        <Button
          :label="$t('g.no')"
          severity="secondary"
          @click="onDeny"
          icon="pi pi-times"
        />
        <Button :label="$t('g.save')" @click="onConfirm" icon="pi pi-save" />
      </template>
      <Button
        v-else-if="type === 'reinstall'"
        :label="$t('desktopMenu.reinstall')"
        severity="warn"
        @click="onConfirm"
        icon="pi pi-eraser"
      />
      <!-- Invalid - just show a close button. -->
      <Button
        v-else
        :label="$t('g.close')"
        severity="primary"
        @click="onCancel"
        icon="pi pi-times"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import type { ConfirmationDialogType } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

const props = defineProps<{
  message: string
  type: ConfirmationDialogType
  onConfirm: (value?: boolean) => void
  itemList?: string[]
}>()

const onCancel = () => useDialogStore().closeDialog()

const onDeny = () => {
  props.onConfirm(false)
  useDialogStore().closeDialog()
}

const onConfirm = () => {
  props.onConfirm(true)
  useDialogStore().closeDialog()
}
</script>

<style lang="css" scoped>
.prompt-dialog-content {
  white-space: pre-wrap;
}
</style>
