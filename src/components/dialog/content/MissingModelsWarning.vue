<template>
  <NoResultsPlaceholder
    class="pb-0"
    icon="pi pi-exclamation-circle"
    title="Missing Models"
    message="When loading the graph, the following models were not found"
  />
  <ListBox
    :options="missingModels"
    optionLabel="label"
    scrollHeight="100%"
    class="comfy-missing-models"
  >
    <template #option="slotProps">
      <div
        class="missing-model-item flex flex-row items-center"
        :style="{ '--progress': `${slotProps.option.progress}%` }"
      >
        <div class="model-info">
          <div class="model-details">
            <span class="model-type" :title="slotProps.option.hint">{{
              slotProps.option.label
            }}</span>
          </div>
          <div v-if="slotProps.option.error" class="model-error">
            {{ slotProps.option.error }}
          </div>
        </div>
        <div class="model-action">
          <Select
            class="model-path-select mr-2"
            v-if="
              slotProps.option.action &&
              !slotProps.option.downloading &&
              !slotProps.option.completed &&
              !slotProps.option.error
            "
            v-show="slotProps.option.paths.length > 1"
            v-model="slotProps.option.folderPath"
            :options="slotProps.option.paths"
            @change="updateFolderPath(slotProps.option, $event)"
          />
          <Button
            v-if="
              slotProps.option.action &&
              !slotProps.option.downloading &&
              !slotProps.option.completed &&
              !slotProps.option.error
            "
            @click="slotProps.option.action.callback"
            :label="slotProps.option.action.text"
            size="small"
            outlined
            class="model-action-button"
          />
          <div v-if="slotProps.option.downloading" class="download-progress">
            <span class="progress-text"
              >{{ slotProps.option.progress.toFixed(2) }}%</span
            >
          </div>
          <div v-if="slotProps.option.completed" class="download-complete">
            <i class="pi pi-check" style="color: var(--p-green-500)"></i>
          </div>
          <div v-if="slotProps.option.error" class="download-error">
            <i class="pi pi-times" style="color: var(--p-red-600)"></i>
          </div>
        </div>
      </div>
    </template>
  </ListBox>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import ListBox from 'primevue/listbox'
import Select from 'primevue/select'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import { SelectChangeEvent } from 'primevue/select'
import Button from 'primevue/button'
import { api } from '@/scripts/api'
import { DownloadModelStatus } from '@/types/apiTypes'

// TODO: Read this from server internal API rather than hardcoding here
// as some installations may wish to use custom sources
const allowedSources = [
  'https://civitai.com/',
  'https://huggingface.co/',
  'http://localhost:' // Included for testing usage only
]
const allowedSuffixes = ['.safetensors', '.sft']

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

const modelDownloads = ref<Record<string, ModelInfo>>({})
let lastModel: string | null = null

const updateFolderPath = (model: any, event: SelectChangeEvent) => {
  const downloadInfo = modelDownloads.value[model.name]
  downloadInfo.folder_path = event.value
  return false
}
const handleDownloadProgress = (detail: DownloadModelStatus) => {
  if (detail.download_path) {
    lastModel = detail.download_path
  }
  if (!lastModel) return
  if (detail.status === 'in_progress') {
    modelDownloads.value[lastModel] = {
      ...modelDownloads.value[lastModel],
      downloading: true,
      progress: detail.progress_percentage,
      completed: false
    }
  } else if (detail.status === 'pending') {
    modelDownloads.value[lastModel] = {
      ...modelDownloads.value[lastModel],
      downloading: true,
      progress: 0,
      completed: false
    }
  } else if (detail.status === 'completed') {
    modelDownloads.value[lastModel] = {
      ...modelDownloads.value[lastModel],
      downloading: false,
      progress: 100,
      completed: true
    }
  } else if (detail.status === 'error') {
    modelDownloads.value[lastModel] = {
      ...modelDownloads.value[lastModel],
      downloading: false,
      progress: 0,
      error: detail.message,
      completed: false
    }
  }
  // TODO: other statuses?
}

const triggerDownload = async (
  url: string,
  directory: string,
  filename: string,
  folder_path: string
) => {
  modelDownloads.value[filename] = {
    name: filename,
    directory,
    url,
    downloading: true,
    progress: 0
  }
  const download = await api.internalDownloadModel(
    url,
    directory,
    filename,
    1,
    folder_path
  )
  lastModel = filename
  handleDownloadProgress(download)
}

api.addEventListener('download_progress', (event: CustomEvent) => {
  handleDownloadProgress(event.detail)
})

const missingModels = computed(() => {
  return props.missingModels.map((model) => {
    const paths = props.paths[model.directory]
    if (model.directory_invalid || !paths) {
      return {
        label: `${model.directory} / ${model.name}`,
        hint: model.url,
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
    if (!allowedSources.some((source) => model.url.startsWith(source))) {
      return {
        label: `${model.directory} / ${model.name}`,
        hint: model.url,
        error: `Download not allowed from source '${model.url}', only allowed from '${allowedSources.join("', '")}'`
      }
    }
    if (!allowedSuffixes.some((suffix) => model.name.endsWith(suffix))) {
      return {
        label: `${model.directory} / ${model.name}`,
        hint: model.url,
        error: `Only allowed suffixes are: '${allowedSuffixes.join("', '")}'`
      }
    }
    return {
      label: `${model.directory} / ${model.name}`,
      hint: model.url,
      downloading: downloadInfo.downloading,
      completed: downloadInfo.completed,
      progress: downloadInfo.progress,
      error: downloadInfo.error,
      name: model.name,
      paths: paths,
      folderPath: downloadInfo.folder_path,
      action: {
        text: 'Download',
        callback: () =>
          triggerDownload(
            model.url,
            model.directory,
            model.name,
            downloadInfo.folder_path
          )
      }
    }
  })
})
</script>

<style scoped>
.comfy-missing-models {
  max-height: 300px;
  overflow-y: auto;
}

.missing-model-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: var(--progress);
  background-color: var(--p-green-500);
  opacity: 0.2;
  transition: width 0.3s ease;
}

.model-info {
  flex: 1;
  min-width: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  margin-right: 1rem;
  overflow: hidden;
}

.model-details {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.model-type {
  font-weight: 600;
  color: var(--text-color);
  margin-right: 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.model-hint {
  font-style: italic;
  color: var(--text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.model-error {
  color: var(--p-red-600);
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.model-action {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  z-index: 1;
}

.model-action-button {
  min-width: 80px;
}

.download-progress,
.download-complete,
.download-error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 80px;
}

.progress-text {
  font-size: 0.8rem;
  color: var(--text-color);
}

.download-complete i,
.download-error i {
  font-size: 1.2rem;
}
</style>
