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
            <span class="model-type">{{ slotProps.option.label }}</span>
            <span v-if="slotProps.option.hint" class="model-hint">{{
              slotProps.option.hint
            }}</span>
          </div>
          <Button
            v-if="slotProps.option.action && !slotProps.option.downloading"
            @click="slotProps.option.action.callback"
            :label="slotProps.option.action.text"
            class="p-button-sm p-button-outlined model-download-button"
          />
          <div v-if="slotProps.option.downloading" class="download-progress">
            <span class="progress-text">{{ slotProps.option.progress.toFixed(2) }}%</span>
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
  url: string
  downloading?: boolean
  progress?: number
}

const props = defineProps<{
  missingModels: ModelInfo[]
  maximized: boolean
}>()

const modelDownloads = ref<Record<string, ModelInfo>>({})

const handleDownloadProgress = (detail: DownloadModelStatus) => {
  console.log('download_progress', detail)
  if (detail.status === 'in_progress') {
    const model = detail.message.split(' ', 2)[1] // TODO: better way to track which model is being downloaded?
    const progress = detail.progress_percentage
    modelDownloads.value[model] = { ...modelDownloads.value[model], downloading: true, progress }
  } else if (detail.status === 'completed') {
    const model = detail.message.split(' ', 3)[2]
    modelDownloads.value[model] = { ...modelDownloads.value[model], downloading: false, progress: 100 }
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
          label: model.name,
          hint: 'Download not allowed from this source'
        }
      }
      return {
        label: model.name,
        hint: model.url,
        downloading: downloadInfo?.downloading ?? false,
        progress: downloadInfo?.progress ?? 0,
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
  align-items: center;
  padding: 0.5rem;
  position: relative;
  overflow: hidden;
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
  flex-grow: 1;
  z-index: 1;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.model-type {
  font-weight: 600;
  color: var(--text-color);
  margin-right: 0.5rem;
}

.model-hint {
  font-style: italic;
  color: var(--text-color-secondary);
}

.model-download-button {
  margin-left: 1rem;
}

.download-progress {
  display: flex;
  align-items: center;
}

.progress-text {
  font-size: 0.8rem;
  color: var(--text-color);
  z-index: 1;
}

:deep(.p-button) {
  margin-left: auto;
  z-index: 1;
}
</style>
