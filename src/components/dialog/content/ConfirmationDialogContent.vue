<template>
  <section class="prompt-dialog-content m-2 mt-4 flex flex-col gap-6">
    <span>{{ message }}</span>
    <ul v-if="itemList?.length" class="m-0 flex flex-col gap-2 pl-4">
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
    <div class="flex justify-end gap-4">
      <div
        v-if="type === 'overwriteBlueprint'"
        class="flex justify-start gap-4"
      >
        <Checkbox
          v-model="doNotAskAgain"
          class="flex justify-start gap-4"
          input-id="doNotAskAgain"
          binary
        />
        <label for="doNotAskAgain" severity="secondary">{{
          t('missingModelsDialog.doNotAskAgain')
        }}</label>
      </div>

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
        v-else-if="type === 'overwrite' || type === 'overwriteBlueprint'"
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
import Checkbox from 'primevue/checkbox'
import Message from 'primevue/message'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSettingStore } from '@/platform/settings/settingStore'
import type { ConfirmationDialogType } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

const props = defineProps<{
  message: string
  type: ConfirmationDialogType
  onConfirm: (value?: boolean) => void
  itemList?: string[]
  hint?: string
}>()

const { t } = useI18n()

const onCancel = () => useDialogStore().closeDialog()

const doNotAskAgain = ref(false)

const onDeny = () => {
  props.onConfirm(false)
  useDialogStore().closeDialog()
}

const onConfirm = () => {
  if (props.type === 'overwriteBlueprint' && doNotAskAgain.value)
    void useSettingStore().set('Comfy.Workflow.WarnBlueprintOverwrite', false)
  props.onConfirm(true)
  useDialogStore().closeDialog()
}
</script>

<style lang="css" scoped>
.prompt-dialog-content {
  white-space: pre-wrap;
}
</style>
