<template>
  <NoResultsPlaceholder
    class="pb-0"
    icon="pi pi-exclamation-circle"
    :title="t('missingModelsDialog.missingModels')"
    :message="t('missingModelsDialog.missingModelsMessage')"
  />
  <div class="flex gap-1 mb-4">
    <Checkbox v-model="doNotAskAgain" binary input-id="doNotAskAgain" />
    <label for="doNotAskAgain">{{
      t('missingModelsDialog.doNotAskAgain')
    }}</label>
  </div>
  <ListBox :options="missingModels" class="comfy-missing-models">
    <template #option="{ option }">
      <Suspense v-if="isElectron()">
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
import Checkbox from 'primevue/checkbox'
import ListBox from 'primevue/listbox'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FileDownload from '@/components/common/FileDownload.vue'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import { useSettingStore } from '@/stores/settingStore'
import { isElectron } from '@/utils/envUtil'

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

const props = defineProps<{
  missingModels: ModelInfo[]
  paths: Record<string, string[]>
}>()

const { t } = useI18n()

const doNotAskAgain = ref(false)

const modelDownloads = ref<Record<string, ModelInfo>>({})
const missingModels = computed(() => {
  return props.missingModels.map((model) => {
    const paths = props.paths[model.directory]
    if (model.directory_invalid || !paths) {
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
      folder_path: paths[0]
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
      paths: paths,
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
