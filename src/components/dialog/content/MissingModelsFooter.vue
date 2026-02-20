<template>
  <div class="flex w-full flex-col gap-2 px-4 py-2">
    <div class="flex flex-col gap-1 text-sm text-muted-foreground">
      <div class="flex items-center gap-1">
        <input
          id="doNotAskAgainModels"
          v-model="doNotAskAgain"
          type="checkbox"
          class="h-4 w-4 cursor-pointer"
        />
        <label for="doNotAskAgainModels">{{
          $t('missingModelsDialog.doNotAskAgain')
        }}</label>
      </div>
      <i18n-t
        v-if="doNotAskAgain"
        keypath="missingModelsDialog.reEnableInSettings"
        tag="span"
        class="ml-6 text-sm text-muted-foreground"
      >
        <template #link>
          <Button
            variant="textonly"
            class="cursor-pointer p-0 text-sm text-muted-foreground underline hover:bg-transparent"
            @click="openShowMissingModelsSetting"
          >
            {{ $t('missingModelsDialog.reEnableInSettingsLink') }}
          </Button>
        </template>
      </i18n-t>
    </div>

    <div class="flex justify-end gap-1">
      <Button variant="secondary" size="md" @click="handleAction">
        {{ buttonLabel }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { isDesktop } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useDialogStore } from '@/stores/dialogStore'
import { useElectronDownloadStore } from '@/stores/electronDownloadStore'

import { hasValidDirectory, isModelDownloadable } from './missingModelsUtils'

interface ModelInfo {
  name: string
  directory: string
  url: string
}

const { missingModels, paths } = defineProps<{
  missingModels: ModelInfo[]
  paths: Record<string, string[]>
}>()

const DIALOG_KEY = 'global-missing-models-warning'
const { t } = useI18n()
const dialogStore = useDialogStore()
const doNotAskAgain = ref(false)

watch(doNotAskAgain, (value) => {
  void useSettingStore().set('Comfy.Workflow.ShowMissingModelsWarning', !value)
})

function openShowMissingModelsSetting() {
  dialogStore.closeDialog({ key: DIALOG_KEY })
  useSettingsDialog().show(undefined, 'Comfy.Workflow.ShowMissingModelsWarning')
}

const downloadableModels = computed(() =>
  missingModels.filter(
    (model) => hasValidDirectory(model, paths) && isModelDownloadable(model)
  )
)

const hasDownloadable = computed(() => downloadableModels.value.length > 0)

const hasCustom = computed(
  () => downloadableModels.value.length < missingModels.length
)

const buttonLabel = computed(() => {
  if (hasDownloadable.value && hasCustom.value)
    return t('missingModelsDialog.downloadAvailable')
  if (hasDownloadable.value) return t('missingModelsDialog.downloadAll')
  return t('missingModelsDialog.gotIt')
})

function handleAction() {
  if (hasDownloadable.value) {
    for (const model of downloadableModels.value) {
      if (isDesktop) {
        const modelPaths = paths[model.directory]
        if (modelPaths?.[0]) {
          void useElectronDownloadStore().start({
            url: model.url,
            savePath: modelPaths[0],
            filename: model.name
          })
        }
      } else {
        const link = document.createElement('a')
        link.href = model.url
        link.download = model.name
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        link.click()
      }
    }
  }
  dialogStore.closeDialog({ key: DIALOG_KEY })
}
</script>
