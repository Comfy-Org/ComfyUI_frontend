<template>
  <!-- Server-side download flow when the server advertises support -->
  <MissingModelCardServerSide
    v-if="useServerSideFlow"
    :missing-model-groups="missingModelGroups"
  />
  <div v-else class="px-3">
    <div
      v-if="importableModelRows.length > 0"
      data-testid="missing-model-importable-rows"
      class="-mx-1.5 flex flex-col gap-1 overflow-hidden px-1.5"
    >
      <MissingModelRow
        v-for="row in importableModelRows"
        :key="row.key"
        :model="row.model"
        :directory="row.directory"
        :is-asset-supported="row.isAssetSupported"
        :can-cloud-import="true"
        :highlighted="isRowHighlighted(row)"
        @locate-model="emit('locateModel', $event)"
      />
    </div>

    <div
      v-if="unsupportedModelRows.length > 0"
      data-testid="missing-model-import-not-supported-section"
      class="flex flex-col gap-1 border-t border-secondary-background pt-3"
    >
      <div class="mb-1">
        <p class="m-0 text-sm font-semibold text-warning-background">
          {{ t('rightSidePanel.missingModels.importNotSupported') }}
        </p>
        <p class="m-0 mt-1 text-xs/relaxed text-muted-foreground">
          {{ t('rightSidePanel.missingModels.customNodeDownloadDisabled') }}
        </p>
      </div>
      <MissingModelRow
        v-for="row in unsupportedModelRows"
        :key="row.key"
        :model="row.model"
        :directory="row.directory"
        :is-asset-supported="row.isAssetSupported"
        :can-cloud-import="false"
        :highlighted="isRowHighlighted(row)"
        @locate-model="emit('locateModel', $event)"
      />
    </div>

    <div
      v-if="downloadableModels.length > 0"
      data-testid="missing-model-actions"
      class="flex items-center pt-2"
    >
      <Button
        data-testid="missing-model-download-all"
        variant="secondary"
        size="sm"
        class="h-8 min-w-0 flex-1 rounded-md text-xs"
        @click="downloadAllModels"
      >
        <i aria-hidden="true" class="icon-[lucide--download] size-4 shrink-0" />
        <span class="truncate">{{ downloadAllLabel }}</span>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MissingModelGroup } from '@/platform/missingModel/types'
import { isCloud } from '@/platform/distribution/types'
import MissingModelRow from '@/platform/missingModel/components/MissingModelRow.vue'
import MissingModelCardServerSide from '@/platform/missingModel/serverDownloads/MissingModelCardServerSide.vue'
import { isServerSideDownloadsAvailable } from '@/platform/missingModel/serverDownloads/useServerSideDownloads'
import Button from '@/components/ui/button/Button.vue'
import { downloadModel } from '@/platform/missingModel/missingModelDownload'
import { getDownloadableModels } from '@/platform/missingModel/missingModelViewUtils'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { formatSize } from '@/utils/formatUtil'

interface MissingModelRowEntry {
  key: string
  model: MissingModelGroup['models'][number]
  directory: string | null
  isAssetSupported: boolean
}

const MODEL_TYPE_SORT_ORDER = [
  'checkpoints',
  'loras',
  'vae',
  'text_encoders',
  'diffusion_models'
] as const

const { missingModelGroups, highlightedNodeIds } = defineProps<{
  missingModelGroups: MissingModelGroup[]
  /** Execution node ids to emphasize (current canvas selection). */
  highlightedNodeIds?: Set<string>
}>()

const emit = defineEmits<{
  locateModel: [nodeId: string]
}>()

const { t } = useI18n()
const missingModelStore = useMissingModelStore()

const sortedModelRows = computed(() =>
  missingModelGroups
    .flatMap((group) =>
      group.models.map((model, index) => ({
        key: getModelRowKey(group, model, index),
        model,
        directory: group.directory,
        isAssetSupported: group.isAssetSupported
      }))
    )
    .sort((a, b) => compareModelRows(a, b))
)

const importableModelRows = computed(() =>
  sortedModelRows.value.filter((row) => !isCloud || canCloudImport(row))
)

const unsupportedModelRows = computed(() =>
  isCloud ? sortedModelRows.value.filter((row) => !canCloudImport(row)) : []
)

const useServerSideFlow = computed(
  () => !isCloud && isServerSideDownloadsAvailable()
)

const downloadableModels = computed(() => {
  if (isCloud) return []

  return getDownloadableModels(missingModelGroups)
})

const downloadAllLabel = computed(() => {
  const base = t('rightSidePanel.missingModels.downloadAll')
  const total = downloadableModels.value.reduce(
    (sum, model) => sum + (missingModelStore.fileSizes[model.url] ?? 0),
    0
  )
  return total > 0 ? `${base} (${formatSize(total)})` : base
})

function downloadAllModels() {
  for (const model of downloadableModels.value) {
    downloadModel(model, missingModelStore.folderPaths)
  }
}

function getModelRowKey(
  group: MissingModelGroup,
  model: MissingModelGroup['models'][number],
  index: number
) {
  const supportKey = group.isAssetSupported ? 'supported' : 'unsupported'
  return [
    supportKey,
    group.directory ?? '__unknown__',
    model.name,
    String(index)
  ].join('::')
}

function compareModelRows(a: MissingModelRowEntry, b: MissingModelRowEntry) {
  return (
    getModelTypeSortIndex(a.directory) - getModelTypeSortIndex(b.directory) ||
    (a.directory ?? '').localeCompare(b.directory ?? '') ||
    a.model.name.localeCompare(b.model.name)
  )
}

function getModelTypeSortIndex(directory: string | null) {
  if (directory === null) return Number.MAX_SAFE_INTEGER
  const index = MODEL_TYPE_SORT_ORDER.indexOf(
    directory as (typeof MODEL_TYPE_SORT_ORDER)[number]
  )
  return index === -1 ? MODEL_TYPE_SORT_ORDER.length : index
}

function canCloudImport(row: MissingModelRowEntry) {
  return row.isAssetSupported && row.directory !== null
}

function isRowHighlighted(row: MissingModelRowEntry) {
  if (!highlightedNodeIds?.size) return false
  return row.model.referencingNodes.some((ref) =>
    highlightedNodeIds.has(String(ref.nodeId))
  )
}
</script>
