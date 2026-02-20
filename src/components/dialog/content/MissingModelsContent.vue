<template>
  <div class="flex w-[490px] flex-col border-t border-border-default">
    <div class="flex h-full w-full flex-col gap-4 p-4">
      <p class="m-0 text-sm leading-5 text-muted-foreground">
        {{ $t('missingModelsDialog.description') }}
      </p>

      <div
        class="flex max-h-[300px] flex-col overflow-y-auto rounded-lg bg-secondary-background scrollbar-custom"
      >
        <div
          v-for="model in processedModels"
          :key="model.name"
          class="flex items-center justify-between px-3 py-2"
        >
          <div class="flex items-center gap-2 overflow-hidden">
            <span
              class="shrink-0 truncate text-sm text-foreground"
              :title="model.name"
            >
              {{ model.name }}
            </span>
            <span
              class="inline-flex h-4 shrink-0 items-center rounded-full bg-muted-foreground/20 px-1.5 text-xxxs font-semibold uppercase text-muted-foreground"
            >
              {{ model.badgeLabel }}
            </span>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <span
              v-if="model.isDownloadable && fileSizes.get(model.url)"
              class="text-xs text-muted-foreground"
            >
              {{ formatSize(fileSizes.get(model.url)) }}
            </span>
            <Button
              v-if="model.isDownloadable"
              variant="textonly"
              size="icon"
              :title="model.url"
              @click="downloadModel(model)"
            >
              <i class="icon-[lucide--download] size-4" />
            </Button>
            <Button
              v-else
              variant="textonly"
              size="icon"
              :title="model.url"
              @click="copyUrl(model.url)"
            >
              <i class="icon-[lucide--copy] size-4" />
            </Button>
          </div>
        </div>

        <div
          v-if="totalDownloadSize > 0"
          class="sticky bottom-0 flex items-center justify-between border-t border-border-default bg-secondary-background px-3 py-2"
        >
          <span class="text-xs font-medium text-muted-foreground">
            {{ $t('missingModelsDialog.totalSize') }}
          </span>
          <span class="text-xs text-muted-foreground">
            {{ formatSize(totalDownloadSize) }}
          </span>
        </div>
      </div>

      <p
        class="m-0 text-xs leading-5 text-muted-foreground whitespace-pre-line"
      >
        {{ $t('missingModelsDialog.footerDescription') }}
      </p>

      <div
        v-if="hasCustomModels"
        class="flex gap-3 rounded-lg border border-warning-background bg-warning-background/10 p-3"
      >
        <i
          class="icon-[lucide--triangle-alert] mt-0.5 h-4 w-4 shrink-0 text-warning-background"
        />
        <div class="flex flex-col gap-1">
          <p
            class="m-0 text-xs font-semibold leading-5 text-warning-background"
          >
            {{ $t('missingModelsDialog.customModelsWarning') }}
          </p>
          <p class="m-0 text-xs leading-5 text-warning-background">
            {{ $t('missingModelsDialog.customModelsInstruction') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { isDesktop } from '@/platform/distribution/types'
import { useElectronDownloadStore } from '@/stores/electronDownloadStore'
import { formatSize } from '@/utils/formatUtil'

import {
  getBadgeLabel,
  hasValidDirectory,
  isModelDownloadable
} from './missingModelsUtils'

interface ModelInfo {
  name: string
  directory: string
  url: string
}

const { missingModels, paths } = defineProps<{
  missingModels: ModelInfo[]
  paths: Record<string, string[]>
}>()

interface ProcessedModel {
  name: string
  url: string
  directory: string
  badgeLabel: string
  isDownloadable: boolean
}

const processedModels = computed<ProcessedModel[]>(() =>
  missingModels.map((model) => ({
    name: model.name,
    url: model.url,
    directory: model.directory,
    badgeLabel: getBadgeLabel(model.directory),
    isDownloadable:
      hasValidDirectory(model, paths) && isModelDownloadable(model)
  }))
)

const hasCustomModels = computed(() =>
  processedModels.value.some((m) => !m.isDownloadable)
)

const fileSizes = reactive(new Map<string, number>())

const totalDownloadSize = computed(() => {
  let total = 0
  for (const model of processedModels.value) {
    if (model.isDownloadable) {
      const size = fileSizes.get(model.url)
      if (size) total += size
    }
  }
  return total
})

onMounted(async () => {
  const downloadableUrls = processedModels.value
    .filter((m) => m.isDownloadable)
    .map((m) => m.url)

  await Promise.allSettled(
    downloadableUrls.map(async (url) => {
      try {
        const response = await fetch(url, { method: 'HEAD' })
        if (!response.ok) return
        const size = response.headers.get('content-length')
        if (size) fileSizes.set(url, parseInt(size))
      } catch {
        // Silently skip size fetch failures
      }
    })
  )
})

const { copyToClipboard } = useCopyToClipboard()

function copyUrl(url: string) {
  void copyToClipboard(url)
}

function downloadModel(model: ProcessedModel) {
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
</script>
