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
        <div class="missing-model-item">
          <span class="model-type">{{ slotProps.option.label }}</span>
          <span v-if="slotProps.option.hint" class="model-hint">{{
            slotProps.option.hint
          }}</span>
          <Button
            v-if="slotProps.option.action"
            @click="slotProps.option.action.callback"
            :label="slotProps.option.action.text"
            class="p-button-sm p-button-outlined"
          />
        </div>
      </template>
    </ListBox>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ListBox from 'primevue/listbox'
import Button from 'primevue/button'
import { api } from '@/scripts/api'
import { DownloadModelStatus } from '@/types/apiTypes';

const allowedSources = ['https://civitai.com/', 'https://huggingface.co/']

interface ModelInfo {
  name: string
  directory: string
  url: string
}

const props = defineProps<{
  missingModels: ModelInfo[]
  maximized: boolean
}>()

const handleDownloadProgress = (detail: DownloadModelStatus) => {
  console.log('download_progress', detail)
  if (detail.status === 'in_progress') {
    const model = detail.message.split(' ', 2)[1] // TODO: better way to track which model is being downloaded?
  } else if (detail.status === 'completed') {
    const model = detail.message.split(' ', 3)[2]
  }
  // TODO: other statuses?
}

const triggerDownload = async (url: string, directory: string, filename: string) => {
  const download = await api.internalDownloadModel(url, directory, filename, 1)
  handleDownloadProgress(download)
}

api.addEventListener('download_progress', (event) => {
  handleDownloadProgress(event.detail)
})

const missingModels = computed(() => {
  return props.missingModels
    .map((model) => {
      if (!allowedSources.some((source) => model.url.startsWith(source))) {
        return {
          label: model.name,
          hint: 'Download not allowed from this source'
        }
      }
      return {
        label: model.name,
        hint: model.url,
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
}

.model-type {
  font-weight: 600;
  color: var(--text-color);
}

.model-hint {
  margin-left: 0.5rem;
  font-style: italic;
  color: var(--text-color-secondary);
}

:deep(.p-button) {
  margin-left: auto;
}
</style>
