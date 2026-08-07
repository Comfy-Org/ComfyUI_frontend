<template>
  <SmallModalShell :title :title-id="titleId">
    <div class="flex flex-col gap-4 wrap-break-word whitespace-pre-wrap">
      <span :id="descriptionId" class="text-sm text-muted-foreground">{{
        message
      }}</span>
      <ul
        v-if="itemList?.length"
        class="m-0 flex flex-col gap-2 pl-4 text-sm text-muted-foreground"
      >
        <li v-for="item of itemList" :key="item">
          {{ item }}
        </li>
      </ul>
      <div
        v-if="hint"
        role="status"
        class="flex items-start gap-2 text-sm text-muted-foreground"
      >
        <i class="pi pi-info-circle mt-0.5" aria-hidden="true" />
        <span>{{ hint }}</span>
      </div>
      <div
        v-if="type === 'overwriteBlueprint'"
        class="flex flex-col justify-start gap-1"
      >
        <div class="flex gap-4">
          <input
            id="doNotAskAgain"
            v-model="doNotAskAgain"
            type="checkbox"
            class="size-4 cursor-pointer"
          />
          <label for="doNotAskAgain" class="text-sm text-muted-foreground">{{
            t('missingModelsDialog.doNotAskAgain')
          }}</label>
        </div>
        <i18n-t
          v-if="doNotAskAgain"
          keypath="missingModelsDialog.reEnableInSettings"
          tag="span"
          class="ml-8 text-sm text-muted-foreground"
        >
          <template #link>
            <Button
              variant="textonly"
              class="cursor-pointer p-0 text-sm text-muted-foreground underline hover:bg-transparent"
              @click="openBlueprintOverwriteSetting"
            >
              {{ t('missingModelsDialog.reEnableInSettingsLink') }}
            </Button>
          </template>
        </i18n-t>
      </div>
    </div>

    <template #footer>
      <Button
        v-if="type !== 'info' && type !== 'dirtyClose'"
        variant="muted-textonly"
        @click="onCancel"
      >
        {{ $t('g.cancel') }}
      </Button>
      <Button
        v-if="type === 'default'"
        variant="primary"
        size="lg"
        @click="onConfirm"
      >
        {{ $t('g.confirm') }}
      </Button>
      <Button
        v-else-if="type === 'delete'"
        variant="destructive"
        size="lg"
        @click="onConfirm"
      >
        {{ $t('g.delete') }}
      </Button>
      <Button
        v-else-if="type === 'overwrite' || type === 'overwriteBlueprint'"
        variant="destructive"
        size="lg"
        @click="onConfirm"
      >
        {{ $t('g.overwrite') }}
      </Button>
      <template v-else-if="type === 'dirtyClose'">
        <Button variant="muted-textonly" @click="onDeny">
          {{ denyLabel ?? $t('g.no') }}
        </Button>
        <Button variant="primary" size="lg" @click="onConfirm">
          {{ $t('g.save') }}
        </Button>
      </template>
      <Button
        v-else-if="type === 'reinstall'"
        variant="destructive"
        size="lg"
        @click="onConfirm"
      >
        {{ $t('desktopMenu.reinstall') }}
      </Button>
      <Button
        v-else-if="type === 'info'"
        variant="primary"
        size="lg"
        @click="onCancel"
      >
        {{ $t('g.ok') }}
      </Button>
      <Button v-else variant="primary" size="lg" @click="onCancel">
        {{ $t('g.close') }}
      </Button>
    </template>
  </SmallModalShell>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import SmallModalShell from '@/components/dialog/SmallModalShell.vue'
import Button from '@/components/ui/button/Button.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import type { ConfirmationDialogType } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

const props = defineProps<{
  title: string
  message: string
  type: ConfirmationDialogType
  onConfirm: (value: boolean) => void
  itemList?: string[]
  hint?: string
  denyLabel?: string
  titleId?: string
  descriptionId?: string
}>()

const { t } = useI18n()

const onCancel = () => useDialogStore().closeDialog()

function openBlueprintOverwriteSetting() {
  useDialogStore().closeDialog()
  useSettingsDialog().show(undefined, 'Comfy.Workflow.WarnBlueprintOverwrite')
}

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
