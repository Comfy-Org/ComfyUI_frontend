<template>
  <div class="comfy-missing-models">
    <h4 class="warning-title">Warning: Missing Models</h4>
    <p class="warning-description">
      When loading the graph, the following models were not found:
    </p>
    <ListBox
      :options="missingModels"
      optionLabel="label"
      scrollHeight="100%"
      :class="'missing-models-list' + (props.maximized ? ' maximized' : '')"
      :pt="{
        list: { class: 'border-none' }
      }"
    >
      <template #option="slotProps">
        <div class="missing-model-item" :style="{ '--progress': `${slotProps.option.progress}%` }">
          <div class="model-info">
            <div class="model-details">
              <span class="model-type" :title=slotProps.option.hint>{{ slotProps.option.label }}</span>
            </div>
            <div v-if="slotProps.option.error" class="model-error">{{ slotProps.option.error }}</div>
          </div>
          <div class="model-action">
            <Button
              v-if="slotProps.option.action && !slotProps.option.downloading && !slotProps.option.completed && !slotProps.option.error"
              @click="slotProps.option.action.callback"
              :label="slotProps.option.action.text"
              class="p-button-sm p-button-outlined model-action-button"
            />
            <div v-if="slotProps.option.downloading" class="download-progress">
              <span class="progress-text">{{ slotProps.option.progress.toFixed(2) }}%</span>
            </div>
            <div v-if="slotProps.option.completed" class="download-complete">
              <i class="pi pi-check" style="color: var(--green-500);"></i>
            </div>
            <div v-if="slotProps.option.error" class="download-error">
              <i class="pi pi-times" style="color: var(--red-600);"></i>
            </div>
          </div>
        </div>
      </template>
    </ListBox>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import ListBox from 'primevue/listbox'
import Button from 'primevue/button'
import { api } from '@/scripts/api'
import { DownloadModelStatus } from '@/types/apiTypes'

const allowedSources = ['https://civitai.com/', 'https://huggingface.co/']

interface ModelInfo {
  name: string
  directory: string
  directory_invalid?: boolean
  url: string
  downloading?: boolean
  completed?: boolean
  progress?: number
  error?: string
}

const props = defineProps<{
  missingModels: ModelInfo[]
  maximized: boolean
}>()

const modelDownloads = ref<Record<string, ModelInfo>>({})
let lastModel: string | null = null

const handleDownloadProgress = (detail: DownloadModelStatus) => {
  if (detail.download_path) {
    lastModel = detail.download_path.split('/', 2)[1]
  }
  if (!lastModel) return
  if (detail.status === 'in_progress') {
    modelDownloads.value[lastModel] = { ...modelDownloads.value[lastModel], downloading: true, progress: detail.progress_percentage, completed: false }
  } else if (detail.status === 'pending') {
    modelDownloads.value[lastModel] = { ...modelDownloads.value[lastModel], downloading: true, progress: 0, completed: false }
  } else if (detail.status === 'completed') {
    modelDownloads.value[lastModel] = { ...modelDownloads.value[lastModel], downloading: false, progress: 100, completed: true }
  } else if (detail.status === 'error') {
    modelDownloads.value[lastModel] = { ...modelDownloads.value[lastModel], downloading: false, progress: 0, error: detail.message, completed: false }
  }
  // TODO: other statuses?
}

const triggerDownload = async (url: string, directory: string, filename: string) => {
  modelDownloads.value[filename] = { name: filename, directory, url, downloading: true, progress: 0 }
  const download = await api.internalDownloadModel(url, directory, filename, 1)
  handleDownloadProgress(download)
}

api.addEventListener('download_progress', (event) => {
  handleDownloadProgress(event.detail)
})

const missingModels = computed(() => {
  return props.missingModels
    .map((model) => {
      const downloadInfo = modelDownloads.value[model.name]
      if (!allowedSources.some((source) => model.url.startsWith(source))) {
        return {
          label: `${model.directory} / ${model.name}`,
          hint: model.url,
          error: 'Download not allowed from this source'
        }
      }
      if (model.directory_invalid) {
        return {
          label: `${model.directory} / ${model.name}`,
          hint: model.url,
          error: 'Invalid directory specified (does this require custom nodes?)'
        }
      }
      return {
        label: `${model.directory} / ${model.name}`,
        hint: model.url,
        downloading: downloadInfo?.downloading ?? false,
        completed: downloadInfo?.completed ?? false,
        progress: downloadInfo?.progress ?? 0,
        error: downloadInfo?.error,
        action: {
          text: 'Download',
          callback: () => triggerDownload(model.url, model.directory, model.name)
        }
      }
    })
})
</script>

<style>
:root {
  --red-600: #dc3545;
  --green-500: #28a745;
}
</style>

<style scoped>
.comfy-missing-models {
  font-family: monospace;
  color: var(--red-600);
  padding: 1.5rem;
  background-color: var(--surface-ground);
  border-radius: var(--border-radius);
  box-shadow: var(--card-shadow);
}

.warning-title {
  margin-top: 0;
  margin-bottom: 1rem;
}

.warning-description {
  margin-bottom: 1rem;
}

.missing-models-list {
  max-height: 300px;
  overflow-y: auto;
}

.missing-models-list.maximized {
  max-height: unset;
}

.missing-model-item {
  display: flex;
  align-items: flex-start;
  padding: 0.5rem;
  position: relative;
  overflow: hidden;
  width: 100%;
}

.missing-model-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: var(--progress);
  background-color: var(--green-500);
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
  color: var(--red-600);
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

.download-progress, .download-complete, .download-error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 80px;
}

.progress-text {
  font-size: 0.8rem;
  color: var(--text-color);
}

.download-complete i, .download-error i {
  font-size: 1.2rem;
}
</style>
