<template>
  <NoResultsPlaceholder
    class="pb-0"
    icon="pi pi-exclamation-circle"
    :title="t('missingModelsDialog.missingModels')"
    :message="t('missingModelsDialog.missingModelsMessage')"
  />
  <div class="mb-4 flex flex-col gap-1">
    <div class="flex gap-1">
      <input
        id="doNotAskAgain"
        v-model="doNotAskAgain"
        type="checkbox"
        class="h-4 w-4 cursor-pointer"
      />
      <label for="doNotAskAgain">{{
        t('missingModelsDialog.doNotAskAgain')
      }}</label>
    </div>
    <i18n-t
      v-if="doNotAskAgain"
      keypath="missingModelsDialog.reEnableInSettings"
      tag="span"
      class="text-sm text-muted-foreground ml-6"
    >
      <template #link>
        <Button
          variant="textonly"
          class="underline cursor-pointer p-0 text-sm text-muted-foreground hover:bg-transparent"
          @click="openShowMissingModelsSetting"
        >
          {{ t('missingModelsDialog.reEnableInSettingsLink') }}
        </Button>
      </template>
    </i18n-t>
  </div>
  <ListBox :options="missingModels" class="comfy-missing-models">
    <template #option="{ option }">
      <Suspense v-if="isDesktop">
        <ElectronFileDownload
          :url="option.url"
          :label="option.label"
          :error="option.error"
        />
      </Suspense>
      <FileDownload
        v-else
        :url="option.url"
        :label="option.label"
        :error="option.error"
      />
    </template>
  </ListBox>
</template>

<script setup lang="ts">
import ListBox from 'primevue/listbox'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import ElectronFileDownload from '@/components/common/ElectronFileDownload.vue'
import FileDownload from '@/components/common/FileDownload.vue'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import { isDesktop } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

// TODO: Read this from server internal API rather than hardcoding here
// as some installations may wish to use custom sources
const allowedSources = [
  'https://civitai.com/',
  'https://huggingface.co/',
  'http://localhost:' // Included for testing usage only
]
const allowedSuffixes = ['.safetensors', '.sft']
// Models that fail above conditions but are still allowed
const whiteListedUrls = new Set([
  'https://huggingface.co/stabilityai/stable-zero123/resolve/main/stable_zero123.ckpt',
  'https://huggingface.co/TencentARC/T2I-Adapter/resolve/main/models/t2iadapter_depth_sd14v1.pth?download=true',
  'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth'
])

interface ModelInfo {
  name: string
  directory: string
  directory_invalid?: boolean
  url: string
  downloading?: boolean
  completed?: boolean
  progress?: number
  error?: string
  folder_path?: string
}

const { missingModels: missingModelsProp, paths } = defineProps<{
  missingModels: ModelInfo[]
  paths: Record<string, string[]>
}>()

const { t } = useI18n()

const doNotAskAgain = ref(false)

function openShowMissingModelsSetting() {
  useDialogStore().closeDialog({ key: 'global-missing-models-warning' })
  void useDialogService().showSettingsDialog(
    undefined,
    'Comfy.Workflow.ShowMissingModelsWarning'
  )
}

const modelDownloads = ref<Record<string, ModelInfo>>({})
const missingModels = computed(() => {
  return missingModelsProp.map((model) => {
    const modelPaths = paths[model.directory]
    if (model.directory_invalid || !modelPaths) {
      return {
        label: `${model.directory} / ${model.name}`,
        url: model.url,
        error: 'Invalid directory specified (does this require custom nodes?)'
      }
    }
    const downloadInfo: ModelInfo = modelDownloads.value[model.name] ?? {
      downloading: false,
      completed: false,
      progress: 0,
      error: null,
      name: model.name,
      directory: model.directory,
      url: model.url,
      folder_path: modelPaths[0]
    }
    modelDownloads.value[model.name] = downloadInfo
    if (!whiteListedUrls.has(model.url)) {
      if (!allowedSources.some((source) => model.url.startsWith(source))) {
        return {
          label: `${model.directory} / ${model.name}`,
          url: model.url,
          error: `Download not allowed from source '${model.url}', only allowed from '${allowedSources.join("', '")}'`
        }
      }
      if (!allowedSuffixes.some((suffix) => model.name.endsWith(suffix))) {
        return {
          label: `${model.directory} / ${model.name}`,
          url: model.url,
          error: `Only allowed suffixes are: '${allowedSuffixes.join("', '")}'`
        }
      }
    }
    return {
      url: model.url,
      label: `${model.directory} / ${model.name}`,
      downloading: downloadInfo.downloading,
      completed: downloadInfo.completed,
      progress: downloadInfo.progress,
      error: downloadInfo.error,
      name: model.name,
      paths: modelPaths,
      folderPath: downloadInfo.folder_path
    }
  })
})

onBeforeUnmount(async () => {
  if (doNotAskAgain.value) {
    await useSettingStore().set(
      'Comfy.Workflow.ShowMissingModelsWarning',
      false
    )
  }
})
</script>

<style scoped>
.comfy-missing-models {
  max-height: 300px;
  overflow-y: auto;
}
</style>
