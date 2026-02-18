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
  <div class="mb-2 flex justify-end">
    <Button
      variant="secondary"
      size="sm"
      :loading="isBulkDownloading"
      :disabled="downloadableModels.length === 0 || isBulkDownloading"
      @click="downloadAllMissingModels"
    >
      {{ t('missingModelsDialog.downloadAll') }}
    </Button>
  </div>
  <ListBox :options="missingModels" class="comfy-missing-models">
    <template #option="{ option }">
      <div class="flex w-full flex-col gap-2">
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
        <div
          v-if="option.downloadStatusLabel || option.downloadProgressLabel"
          class="flex items-center justify-between text-xs text-muted-foreground"
        >
          <div class="flex items-center gap-2">
            <span>{{ option.downloadStatusLabel }}</span>
            <Button
              v-if="option.canCancel"
              variant="destructive"
              size="icon-sm"
              class="size-[20px]"
              :disabled="option.canceling"
              :loading="option.canceling"
              @click.stop="
                cancelMissingModelDownload(option.name, option.directory)
              "
            >
              <i class="icon-[lucide--x] size-3" />
            </Button>
          </div>
          <span v-if="option.downloadProgressLabel">{{
            option.downloadProgressLabel
          }}</span>
        </div>
      </div>
    </template>
  </ListBox>
</template>

<script setup lang="ts">
import ListBox from 'primevue/listbox'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import ElectronFileDownload from '@/components/common/ElectronFileDownload.vue'
import FileDownload from '@/components/common/FileDownload.vue'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import { isDesktop } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
import type { MissingModelDownloadItem } from '@/scripts/api'
import type { MissingModelDownloadWsMessage } from '@/schemas/apiSchema'
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
}

type DownloadStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped_existing'
  | 'blocked'
  | 'canceled'

interface ModelDownloadInfo {
  name: string
  directory: string
  url: string
  taskId: string | null
  status: DownloadStatus
  canceling: boolean
  completed: boolean
  bytesDownloaded: number
  error: string | null
  folderPath: string
}

const props = defineProps<{
  missingModels: ModelInfo[]
  paths: Record<string, string[]>
}>()

const { t } = useI18n()

const doNotAskAgain = ref(false)
const isBulkDownloading = ref(false)
const activeBatchId = ref<string | null>(null)

function openShowMissingModelsSetting() {
  useDialogStore().closeDialog({ key: 'global-missing-models-warning' })
  useSettingsDialog().show(undefined, 'Comfy.Workflow.ShowMissingModelsWarning')
}

const modelDownloads = ref<Record<string, ModelDownloadInfo>>({})

function createBatchId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function modelKey(model: Pick<ModelInfo, 'name' | 'directory'>): string {
  return `${model.directory}::${model.name}`
}

function getOrCreateDownloadInfo(
  model: ModelInfo,
  folderPath: string
): ModelDownloadInfo {
  const key = modelKey(model)
  const existing = modelDownloads.value[key]
  if (existing) {
    return existing
  }

  const created: ModelDownloadInfo = {
    name: model.name,
    directory: model.directory,
    url: model.url,
    taskId: null,
    status: 'idle',
    canceling: false,
    completed: false,
    bytesDownloaded: 0,
    error: null,
    folderPath
  }
  modelDownloads.value[key] = created
  return created
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

function getDownloadStatusLabel(info: ModelDownloadInfo): string {
  switch (info.status) {
    case 'running':
      return t('g.downloading')
    case 'completed':
      return t('g.completed')
    case 'failed':
      return info.error ? `${t('g.failed')}: ${info.error}` : t('g.failed')
    case 'blocked':
      return info.error ? `Blocked: ${info.error}` : 'Blocked'
    case 'skipped_existing':
      return 'Skipped (already exists)'
    case 'canceled':
      return 'Canceled'
    default:
      return ''
  }
}

function getDownloadProgressLabel(info: ModelDownloadInfo): string {
  if (info.bytesDownloaded <= 0) {
    return ''
  }
  return formatBytes(info.bytesDownloaded)
}

function handleMissingModelDownload(
  e: CustomEvent<MissingModelDownloadWsMessage>
) {
  const data = e.detail
  if (activeBatchId.value && data.batch_id !== activeBatchId.value) {
    return
  }

  const key = modelKey({ name: data.name, directory: data.directory })
  const existing = modelDownloads.value[key] ?? {
    name: data.name,
    directory: data.directory,
    url: data.url,
    taskId: null,
    status: 'idle' as DownloadStatus,
    canceling: false,
    completed: false,
    bytesDownloaded: 0,
    error: null,
    folderPath: ''
  }

  const status = data.status
  modelDownloads.value[key] = {
    ...existing,
    name: data.name,
    directory: data.directory,
    url: data.url,
    taskId: data.task_id,
    status,
    canceling: false,
    completed: status === 'completed' || status === 'skipped_existing',
    bytesDownloaded: data.bytes_downloaded,
    error: data.error ?? null
  }
}

const missingModels = computed(() => {
  return props.missingModels.map((model) => {
    const paths = props.paths[model.directory]
    const folderPath = paths?.[0] ?? ''
    const downloadInfo = getOrCreateDownloadInfo(model, folderPath)

    if (model.directory_invalid || !paths) {
      return {
        name: model.name,
        directory: model.directory,
        label: `${model.directory} / ${model.name}`,
        url: model.url,
        error: 'Invalid directory specified (does this require custom nodes?)',
        downloading: false,
        completed: false,
        downloadStatusLabel: '',
        downloadProgressLabel: '',
      }
    }

    let validationError: string | undefined
    if (!whiteListedUrls.has(model.url)) {
      if (!allowedSources.some((source) => model.url.startsWith(source))) {
        validationError = `Download not allowed from source '${model.url}', only allowed from '${allowedSources.join("', '")}'`
      }
      if (!allowedSuffixes.some((suffix) => model.name.endsWith(suffix))) {
        validationError =
          validationError ??
          `Only allowed suffixes are: '${allowedSuffixes.join("', '")}'`
      }
    }

    return {
      url: model.url,
      label: `${model.directory} / ${model.name}`,
      downloading: downloadInfo.status === 'running',
      canCancel: downloadInfo.status === 'running' && !!downloadInfo.taskId,
      canceling: downloadInfo.canceling,
      completed: downloadInfo.completed,
      error: validationError,
      downloadStatusLabel: getDownloadStatusLabel(downloadInfo),
      downloadProgressLabel: getDownloadProgressLabel(downloadInfo),
      name: model.name,
      directory: model.directory,
      paths,
      folderPath: downloadInfo.folderPath
    }
  })
})

const downloadableModels = computed<MissingModelDownloadItem[]>(() => {
  return missingModels.value
    .filter((model) => !model.error)
    .map((model) => ({
      name: model.name,
      directory: model.directory,
      url: model.url
    }))
})

async function downloadAllMissingModels() {
  if (!downloadableModels.value.length || isBulkDownloading.value) {
    return
  }

  const batchId = createBatchId()
  activeBatchId.value = batchId

  for (const model of downloadableModels.value) {
    const key = modelKey(model)
    const existing = modelDownloads.value[key] ?? {
      name: model.name,
      directory: model.directory,
      url: model.url,
      taskId: null,
      status: 'idle' as DownloadStatus,
      canceling: false,
      completed: false,
      bytesDownloaded: 0,
      error: null,
      folderPath: props.paths[model.directory]?.[0] ?? ''
    }

    modelDownloads.value[key] = {
      ...existing,
      taskId: null,
      status: 'idle',
      canceling: false,
      completed: false,
      bytesDownloaded: 0,
      error: null
    }
  }

  isBulkDownloading.value = true
  try {
    const result = await api.downloadMissingModels(downloadableModels.value, {
      batchId
    })

    for (const modelResult of result.results) {
      const key = modelKey(modelResult)
      const existing = modelDownloads.value[key]
      if (!existing) {
        continue
      }

      const status: DownloadStatus =
        modelResult.status === 'downloaded'
          ? 'completed'
          : modelResult.status
      const completed = status === 'completed' || status === 'skipped_existing'

      modelDownloads.value[key] = {
        ...existing,
        status,
        canceling: false,
        completed,
        error: modelResult.error ?? null
      }
    }

    const severity =
      result.failed > 0
        ? result.downloaded + result.skipped > 0
          ? 'warn'
          : 'error'
        : 'success'

    useToastStore().add({
      severity,
      summary: t('missingModelsDialog.downloadAll'),
      detail: t('missingModelsDialog.downloadAllResult', {
        downloaded: result.downloaded,
        skipped: result.skipped,
        failed: result.failed
      }),
      life: 6000
    })
  } catch {
    useToastStore().add({
      severity: 'error',
      summary: t('missingModelsDialog.downloadAll'),
      detail: t('missingModelsDialog.downloadAllRequestFailed'),
      life: 5000
    })
  } finally {
    isBulkDownloading.value = false
    activeBatchId.value = null
  }
}

async function cancelMissingModelDownload(name: string, directory: string) {
  const key = modelKey({ name, directory })
  const info = modelDownloads.value[key]
  if (!info?.taskId || info.status !== 'running' || info.canceling) {
    return
  }

  modelDownloads.value[key] = {
    ...info,
    canceling: true
  }

  try {
    await api.cancelMissingModelDownload(info.taskId, {
      batchId: activeBatchId.value ?? undefined
    })
  } catch {
    modelDownloads.value[key] = {
      ...modelDownloads.value[key],
      canceling: false
    }
    useToastStore().add({
      severity: 'error',
      summary: t('missingModelsDialog.downloadAll'),
      detail: 'Failed to cancel download.',
      life: 3000
    })
  }
}

onMounted(() => {
  api.addEventListener('missing_model_download', handleMissingModelDownload)
})

onBeforeUnmount(async () => {
  api.removeEventListener('missing_model_download', handleMissingModelDownload)
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
