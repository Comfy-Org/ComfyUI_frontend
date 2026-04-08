<template>
  <div class="flex w-full flex-col pb-3">
    <!-- Model header -->
    <div class="flex h-8 w-full items-center gap-2">
      <i
        aria-hidden="true"
        class="text-foreground icon-[lucide--file-check] size-4 shrink-0"
      />

      <div class="flex min-w-0 flex-1 items-center">
        <p
          class="text-foreground min-w-0 truncate text-sm font-medium"
          :title="model.name"
        >
          {{ model.name }} ({{ model.referencingNodes.length }})
        </p>

        <Button
          data-testid="missing-model-copy-name"
          variant="textonly"
          size="icon-sm"
          class="size-8 shrink-0 hover:bg-transparent"
          :aria-label="t('rightSidePanel.missingModels.copyModelName')"
          :title="t('rightSidePanel.missingModels.copyModelName')"
          @click="copyToClipboard(model.name)"
        >
          <i
            aria-hidden="true"
            class="icon-[lucide--copy] size-3.5 text-muted-foreground"
          />
        </Button>
      </div>

      <Button
        v-if="!isCloud && model.representative.url && !isAssetSupported"
        data-testid="missing-model-copy-url"
        variant="secondary"
        size="sm"
        class="h-8 shrink-0 rounded-lg text-sm"
        @click="copyToClipboard(toBrowsableUrl(model.representative.url!))"
      >
        {{ t('rightSidePanel.missingModels.copyUrl') }}
      </Button>

      <Button
        variant="textonly"
        size="icon-sm"
        :aria-label="t('rightSidePanel.missingModels.confirmSelection')"
        :disabled="!canConfirm"
        :class="
          cn(
            'size-8 shrink-0 rounded-lg transition-colors',
            canConfirm ? 'bg-primary/10 hover:bg-primary/15' : 'opacity-20'
          )
        "
        @click="handleLibrarySelect"
      >
        <i
          aria-hidden="true"
          class="icon-[lucide--check] size-4"
          :class="canConfirm ? 'text-primary' : 'text-foreground'"
        />
      </Button>

      <Button
        v-if="model.referencingNodes.length > 0"
        data-testid="missing-model-expand"
        variant="textonly"
        size="icon-sm"
        :aria-label="
          expanded
            ? t('rightSidePanel.missingModels.collapseNodes')
            : t('rightSidePanel.missingModels.expandNodes')
        "
        :aria-expanded="expanded"
        :class="
          cn(
            'size-8 shrink-0 transition-transform duration-200 hover:bg-transparent',
            expanded && 'rotate-180'
          )
        "
        @click="toggleModelExpand(modelKey)"
      >
        <i
          aria-hidden="true"
          class="icon-[lucide--chevron-down] size-4 text-muted-foreground group-hover:text-base-foreground"
        />
      </Button>
    </div>

    <!-- Referencing nodes -->
    <TransitionCollapse>
      <div
        v-if="expanded"
        class="mb-1 flex flex-col gap-0.5 overflow-hidden pl-6"
      >
        <div
          v-for="ref in model.referencingNodes"
          :key="`${String(ref.nodeId)}::${ref.widgetName}`"
          class="flex h-7 items-center"
        >
          <span
            v-if="showNodeIdBadge"
            class="mr-1 shrink-0 rounded-md bg-secondary-background-selected px-2 py-0.5 font-mono text-xs font-bold text-muted-foreground"
          >
            #{{ ref.nodeId }}
          </span>
          <p class="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {{ getNodeDisplayLabel(ref.nodeId, model.representative.nodeType) }}
          </p>
          <Button
            data-testid="missing-model-locate"
            variant="textonly"
            size="icon-sm"
            :aria-label="t('rightSidePanel.missingModels.locateNode')"
            class="mr-1 size-6 shrink-0 text-muted-foreground hover:text-base-foreground"
            @click="emit('locateModel', String(ref.nodeId))"
          >
            <i aria-hidden="true" class="icon-[lucide--locate] size-3" />
          </Button>
        </div>
      </div>
    </TransitionCollapse>

    <!-- Status card -->
    <TransitionCollapse>
      <MissingModelStatusCard
        v-if="selectedLibraryModel[modelKey]"
        :model-name="selectedLibraryModel[modelKey]"
        :is-download-active="isDownloadActive"
        :download-status="downloadStatus"
        :category-mismatch="importCategoryMismatch[modelKey]"
        @cancel="cancelLibrarySelect(modelKey)"
      />
    </TransitionCollapse>

    <!-- Input area -->
    <TransitionCollapse>
      <div
        v-if="!selectedLibraryModel[modelKey]"
        class="mt-1 flex flex-col gap-1"
      >
        <div v-if="isAssetSupported" class="flex w-full flex-col py-1">
          <MissingModelUrlInput
            :model-key="modelKey"
            :directory="directory"
            :type-mismatch="typeMismatch"
          />
        </div>
        <div
          v-else-if="!isCloud && downloadable"
          class="flex w-full items-start py-1"
        >
          <Button
            data-testid="missing-model-download"
            variant="secondary"
            size="md"
            class="flex w-full flex-1"
            :aria-label="`${t('g.download')} ${model.name}`"
            @click="handleDownload"
          >
            <i
              aria-hidden="true"
              class="text-foreground mr-1 icon-[lucide--download] size-4 shrink-0"
            />
            <span class="text-foreground min-w-0 truncate text-sm">
              {{ downloadLabel }}
            </span>
          </Button>
        </div>

        <TransitionCollapse>
          <MissingModelLibrarySelect
            v-if="!urlInputs[modelKey]"
            :model-value="getComboValue(model.representative)"
            :options="comboOptions"
            :show-divider="isAssetSupported || downloadable"
            @select="handleComboSelect(modelKey, $event)"
          />
        </TransitionCollapse>
      </div>
    </TransitionCollapse>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { cn } from '@/utils/tailwindUtil'
import Button from '@/components/ui/button/Button.vue'
import TransitionCollapse from '@/components/rightSidePanel/layout/TransitionCollapse.vue'
import MissingModelStatusCard from '@/platform/missingModel/components/MissingModelStatusCard.vue'
import MissingModelUrlInput from '@/platform/missingModel/components/MissingModelUrlInput.vue'
import MissingModelLibrarySelect from '@/platform/missingModel/components/MissingModelLibrarySelect.vue'
import type { MissingModelViewModel } from '@/platform/missingModel/types'

import {
  useMissingModelInteractions,
  getModelStateKey,
  getNodeDisplayLabel,
  getComboValue
} from '@/platform/missingModel/composables/useMissingModelInteractions'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { isCloud } from '@/platform/distribution/types'
import {
  downloadModel,
  fetchModelMetadata,
  isModelDownloadable,
  toBrowsableUrl
} from '@/platform/missingModel/missingModelDownload'
import { formatSize } from '@/utils/formatUtil'

const { model, directory, isAssetSupported } = defineProps<{
  model: MissingModelViewModel
  directory: string | null
  showNodeIdBadge: boolean
  isAssetSupported: boolean
}>()

const emit = defineEmits<{
  locateModel: [nodeId: string]
}>()

const { t } = useI18n()
const { copyToClipboard } = useCopyToClipboard()

const modelKey = computed(() =>
  getModelStateKey(model.name, directory, isAssetSupported)
)

const downloadStatus = computed(() => getDownloadStatus(modelKey.value))
const comboOptions = computed(() => getComboOptions(model.representative))
const canConfirm = computed(() => isSelectionConfirmable(modelKey.value))
const expanded = computed(() => isModelExpanded(modelKey.value))
const typeMismatch = computed(() => getTypeMismatch(modelKey.value, directory))
const isDownloadActive = computed(
  () =>
    downloadStatus.value?.status === 'running' ||
    downloadStatus.value?.status === 'created'
)

const store = useMissingModelStore()
const { selectedLibraryModel, importCategoryMismatch, urlInputs } =
  storeToRefs(store)

onMounted(() => {
  const url = model.representative.url
  if (url && !store.fileSizes[url]) {
    fetchModelMetadata(url).then((metadata) => {
      if (metadata.fileSize !== null) {
        store.setFileSize(url, metadata.fileSize)
      }
    })
  }
})

const downloadable = computed(() => {
  const rep = model.representative
  return !!(
    !isAssetSupported &&
    rep.url &&
    rep.directory &&
    isModelDownloadable({
      name: rep.name,
      url: rep.url,
      directory: rep.directory
    })
  )
})

const downloadLabel = computed(() => {
  const base = t('g.download')
  const url = model.representative.url
  const size = url ? store.fileSizes[url] : undefined
  return size ? `${base} (${formatSize(size)})` : base
})

function handleDownload() {
  const rep = model.representative
  if (rep.url && rep.directory) {
    downloadModel(
      { name: rep.name, url: rep.url, directory: rep.directory },
      store.folderPaths
    )
  } else {
    console.warn('[MissingModelRow] Cannot download: missing url or directory')
  }
}

const {
  toggleModelExpand,
  isModelExpanded,
  getComboOptions,
  handleComboSelect,
  isSelectionConfirmable,
  cancelLibrarySelect,
  confirmLibrarySelect,
  getTypeMismatch,
  getDownloadStatus
} = useMissingModelInteractions()

function handleLibrarySelect() {
  confirmLibrarySelect(
    modelKey.value,
    model.name,
    model.referencingNodes,
    directory
  )
}
</script>
