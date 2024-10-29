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
          <Button
            class="model-action-button"
            :label="$t('Download')"
            size="small"
            outlined
            :disabled="slotProps.option.error"
            @click="slotProps.option.action"
          />
        </div>
      </div>
    </template>
  </ListBox>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import ListBox from 'primevue/listbox'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import Button from 'primevue/button'

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
      action: () => console.log('download!')
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

.model-action {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  z-index: 1;
}
</style>
