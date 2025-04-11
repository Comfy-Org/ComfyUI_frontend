<template>
  <section class="prompt-dialog-content flex flex-col gap-6 m-2 mt-4">
    <span>{{ message }}</span>
    <ul v-if="itemList?.length" class="pl-4 m-0 flex flex-col gap-2">
      <li v-for="item of itemList" :key="item">
        {{ item }}
      </li>
    </ul>
    <Message
      v-if="hint"
      icon="pi pi-info-circle"
      severity="secondary"
      size="small"
      variant="simple"
    >
      {{ hint }}
    </Message>
    <div class="flex gap-4 justify-end">
      <Button
        :label="$t('g.cancel')"
        icon="pi pi-undo"
        severity="secondary"
        autofocus
        @click="onCancel"
      />
      <Button
        v-if="type === 'default'"
        :label="$t('g.confirm')"
        severity="primary"
        icon="pi pi-check"
        @click="onConfirm"
      />
      <Button
        v-else-if="type === 'delete'"
        :label="$t('g.delete')"
        severity="danger"
        icon="pi pi-trash"
        @click="onConfirm"
      />
      <Button
        v-else-if="type === 'overwrite'"
        :label="$t('g.overwrite')"
        severity="warn"
        icon="pi pi-save"
        @click="onConfirm"
      />
      <template v-else-if="type === 'dirtyClose'">
        <Button
          :label="$t('g.no')"
          severity="secondary"
          icon="pi pi-times"
          @click="onDeny"
        />
        <Button :label="$t('g.save')" icon="pi pi-save" @click="onConfirm" />
      </template>
      <Button
        v-else-if="type === 'reinstall'"
        :label="$t('desktopMenu.reinstall')"
        severity="warn"
        icon="pi pi-eraser"
        @click="onConfirm"
      />
      <!-- Invalid - just show a close button. -->
      <Button
        v-else
        :label="$t('g.close')"
        severity="primary"
        icon="pi pi-times"
        @click="onCancel"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'

import type { ConfirmationDialogType } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

const props = defineProps<{
  message: string
  type: ConfirmationDialogType
  onConfirm: (value?: boolean) => void
  itemList?: string[]
  hint?: string
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
