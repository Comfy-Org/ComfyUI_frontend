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

      <Button variant="secondary" autofocus @click="onCancel">
        <i class="pi pi-undo" />
        {{ $t('g.cancel') }}
      </Button>
      <Button v-if="type === 'default'" variant="primary" @click="onConfirm">
        <i class="pi pi-check" />
        {{ $t('g.confirm') }}
      </Button>
      <Button
        v-else-if="type === 'delete'"
        variant="destructive"
        @click="onConfirm"
      >
        <i class="pi pi-trash" />
        {{ $t('g.delete') }}
      </Button>
      <Button
        v-else-if="type === 'overwrite' || type === 'overwriteBlueprint'"
        variant="destructive"
        @click="onConfirm"
      >
        <i class="pi pi-save" />
        {{ $t('g.overwrite') }}
      </Button>
      <template v-else-if="type === 'dirtyClose'">
        <Button variant="secondary" @click="onDeny">
          <i class="pi pi-times" />
          {{ $t('g.no') }}
        </Button>
        <Button @click="onConfirm">
          <i class="pi pi-save" />
          {{ $t('g.save') }}
        </Button>
      </template>
      <Button
        v-else-if="type === 'reinstall'"
        variant="destructive"
        @click="onConfirm"
      >
        <i class="pi pi-eraser" />
        {{ $t('desktopMenu.reinstall') }}
      </Button>
      <!-- Invalid - just show a close button. -->
      <Button v-else variant="primary" @click="onCancel">
        <i class="pi pi-times" />
        {{ $t('g.close') }}
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import Checkbox from 'primevue/checkbox'
import Message from 'primevue/message'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
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
