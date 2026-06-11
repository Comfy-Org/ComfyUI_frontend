<template>
  <div class="mb-1 flex w-full flex-col gap-0.5 last:mb-0">
    <div class="flex min-h-8 w-full items-center gap-1">
      <Button
        v-if="hasMultipleReferences"
        data-testid="missing-model-expand"
        variant="textonly"
        size="unset"
        :aria-label="
          expanded
            ? t('rightSidePanel.missingModels.collapseNodes')
            : t('rightSidePanel.missingModels.expandNodes')
        "
        :aria-expanded="expanded"
        :class="
          cn(
            'h-8 w-4 shrink-0 p-0 transition-transform duration-200 hover:bg-transparent',
            expanded && 'rotate-90'
          )
        "
        @click="handleToggleExpand"
      >
        <i
          aria-hidden="true"
          class="icon-[lucide--chevron-right] size-4 text-muted-foreground"
        />
      </Button>

      <span class="flex min-w-0 flex-1 flex-col gap-0">
        <span class="flex min-w-0 items-center gap-2">
          <span class="flex min-w-0 items-center gap-2.5">
            <button
              v-if="hasMultipleReferences"
              type="button"
              class="m-0 inline max-w-full cursor-pointer appearance-none border-0 bg-transparent p-0 text-left text-sm/relaxed font-normal wrap-break-word text-base-foreground outline-none hover:text-base-foreground focus:outline-none focus-visible:underline focus-visible:ring-0 focus-visible:outline-none"
              :title="displayModelName"
              @click="handleToggleExpand"
            >
              {{ displayModelName }}
            </button>
            <button
              v-else-if="!isUnknownCategory && primaryReference"
              type="button"
              class="m-0 inline max-w-full cursor-pointer appearance-none border-0 bg-transparent p-0 text-left text-sm/relaxed font-normal wrap-break-word text-base-foreground outline-none hover:text-base-foreground focus:outline-none focus-visible:underline focus-visible:ring-0 focus-visible:outline-none"
              :title="displayModelName"
              @click="handleLocatePrimary"
            >
              {{ displayModelName }}
            </button>
            <span
              v-else
              class="min-w-0 truncate text-sm/relaxed font-normal text-base-foreground"
              :title="displayModelName"
            >
              {{ displayModelName }}
            </span>
            <span
              v-if="hasMultipleReferences"
              class="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary-background-selected text-xs font-bold text-muted-foreground"
            >
              {{ model.referencingNodes.length }}
            </span>
          </span>
          <Button
            data-testid="missing-model-copy-name"
            variant="textonly"
            size="icon-sm"
            class="size-7 shrink-0 text-muted-foreground hover:bg-transparent hover:text-base-foreground"
            :aria-label="linkLabel"
            :title="linkLabel"
            @click="copyModelLink"
          >
            <i aria-hidden="true" class="icon-[lucide--link] size-4" />
          </Button>
        </span>
        <span
          v-if="modelMetadataLabel"
          class="text-2xs/none"
          :class="
            isUnknownCategory
              ? 'text-warning-background'
              : 'text-muted-foreground'
          "
        >
          {{ modelMetadataLabel }}
        </span>
      </span>

      <template v-if="isCloud">
        <Button
          v-if="!isCloudImportDownloadActive"
          data-testid="missing-model-import"
          variant="secondary"
          size="sm"
          class="h-8 shrink-0 rounded-lg text-sm"
          @click="showUploadDialog"
        >
          {{ t('g.import') }}
        </Button>
        <div
          v-else
          role="progressbar"
          :aria-label="t('rightSidePanel.missingModels.importing')"
          :aria-valuenow="cloudImportProgressPercent"
          aria-valuemin="0"
          aria-valuemax="100"
          class="flex h-8 w-16 shrink-0 items-center"
        >
          <span
            class="block h-1.5 w-full overflow-hidden rounded-full bg-secondary-background-selected"
          >
            <span
              class="block h-full rounded-full bg-primary-background transition-all duration-200 ease-linear"
              :style="{ width: `${cloudImportProgressPercent}%` }"
            />
          </span>
        </div>
      </template>

      <template v-else>
        <Button
          v-if="showDownloadAction"
          data-testid="missing-model-download"
          variant="secondary"
          size="sm"
          class="h-8 shrink-0 rounded-lg text-sm"
          :aria-label="`${t('g.download')} ${model.name}`"
          @click="handleDownload"
        >
          {{ t('g.download') }}
        </Button>
        <Button
          v-else-if="showConfirmAction"
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
      </template>

      <Button
        v-if="!hasMultipleReferences && !isUnknownCategory && primaryReference"
        data-testid="missing-model-locate"
        variant="textonly"
        size="icon-sm"
        :aria-label="t('rightSidePanel.missingModels.locateNode')"
        class="size-8 shrink-0 text-muted-foreground hover:text-base-foreground"
        @click="handleLocatePrimary"
      >
        <i aria-hidden="true" class="icon-[lucide--locate] size-4" />
      </Button>
    </div>

    <TransitionCollapse>
      <ul
        v-if="showReferenceList"
        :class="
          cn(
            'm-0 list-none space-y-1 p-0',
            (hasMultipleReferences || isUnknownCategory) && 'pl-5'
          )
        "
      >
        <li
          v-for="ref in model.referencingNodes"
          :key="`${String(ref.nodeId)}::${ref.widgetName}`"
          class="min-w-0"
        >
          <div class="flex min-w-0 items-center gap-2">
            <button
              type="button"
              class="m-0 inline max-w-full cursor-pointer appearance-none border-0 bg-transparent p-0 text-left text-sm/relaxed font-normal wrap-break-word text-muted-foreground outline-none hover:text-base-foreground focus:outline-none focus-visible:underline focus-visible:ring-0 focus-visible:outline-none"
              @click="emit('locateModel', String(ref.nodeId))"
            >
              {{
                getNodeDisplayLabel(ref.nodeId, model.representative.nodeType)
              }}
            </button>
            <Button
              data-testid="missing-model-locate"
              variant="textonly"
              size="icon-sm"
              :aria-label="t('rightSidePanel.missingModels.locateNode')"
              class="ml-auto size-8 shrink-0 text-muted-foreground hover:text-base-foreground"
              @click="emit('locateModel', String(ref.nodeId))"
            >
              <i aria-hidden="true" class="icon-[lucide--locate] size-4" />
            </Button>
          </div>
        </li>
      </ul>
    </TransitionCollapse>

    <template v-if="!isCloud">
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
        </div>
      </TransitionCollapse>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { cn } from '@comfyorg/tailwind-utils'
import Button from '@/components/ui/button/Button.vue'
import TransitionCollapse from '@/components/rightSidePanel/layout/TransitionCollapse.vue'
import MissingModelStatusCard from '@/platform/missingModel/components/MissingModelStatusCard.vue'
import MissingModelUrlInput from '@/platform/missingModel/components/MissingModelUrlInput.vue'
import type { MissingModelViewModel } from '@/platform/missingModel/types'
import type { UploadModelDialogContext } from '@/platform/assets/composables/useUploadModelWizard'

import { useModelUpload } from '@/platform/assets/composables/useModelUpload'
import {
  useMissingModelInteractions,
  getModelStateKey,
  getNodeDisplayLabel
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
const canConfirm = computed(() => isSelectionConfirmable(modelKey.value))
const typeMismatch = computed(() => getTypeMismatch(modelKey.value, directory))
const isUnknownCategory = computed(() => directory === null)
const isDownloadActive = computed(
  () =>
    downloadStatus.value?.status === 'running' ||
    downloadStatus.value?.status === 'created'
)
const isCloudImportDownloadActive = computed(
  () => isCloud && isDownloadActive.value
)
const cloudImportProgressPercent = computed(() =>
  Math.round((downloadStatus.value?.progress ?? 0) * 100)
)
const hasMultipleReferences = computed(() => model.referencingNodes.length > 1)
const primaryReference = computed(() => model.referencingNodes[0])
const linkLabel = computed(() =>
  model.representative.url
    ? t('rightSidePanel.missingModels.copyUrl')
    : t('rightSidePanel.missingModels.copyModelName')
)

const store = useMissingModelStore()
const { selectedLibraryModel, importCategoryMismatch } = storeToRefs(store)

const expanded = computed(
  () =>
    store.modelExpandState[modelKey.value] ??
    (isUnknownCategory.value && hasMultipleReferences.value)
)
const showReferenceList = computed(
  () =>
    (isUnknownCategory.value && model.referencingNodes.length === 1) ||
    (hasMultipleReferences.value && expanded.value)
)

const displayModelName = computed(() => {
  if (!isCloudImportDownloadActive.value) return model.name

  return (
    downloadStatus.value?.assetName ??
    selectedLibraryModel.value[modelKey.value] ??
    model.name
  )
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

const showDownloadAction = computed(
  () =>
    !isCloud &&
    downloadable.value &&
    !selectedLibraryModel.value[modelKey.value]
)
const showConfirmAction = computed(
  () => !isCloud && !!selectedLibraryModel.value[modelKey.value]
)

const downloadSizeLabel = computed(() => {
  if (!showDownloadAction.value) return undefined

  const url = model.representative.url
  const size = url ? store.fileSizes[url] : undefined
  return size ? formatSize(size) : undefined
})
const modelTypeLabel = computed(
  () => directory ?? t('rightSidePanel.missingModels.unknownCategory')
)
const modelMetadataLabel = computed(() =>
  [modelTypeLabel.value, downloadSizeLabel.value].filter(Boolean).join(' · ')
)

const missingModelUploadContext = computed<
  UploadModelDialogContext | undefined
>(() => {
  if (!directory) return undefined

  return {
    kind: 'missing-model-resolution',
    missingModelName: model.name,
    requiredModelType: directory,
    replacementTargets: model.referencingNodes.map((ref) => ({
      nodeId: String(ref.nodeId),
      nodeLabel: getNodeDisplayLabel(ref.nodeId, model.representative.nodeType),
      widgetName: ref.widgetName
    }))
  }
})

const { showUploadDialog } = useModelUpload(
  (result) => {
    handleUploadedModelImport(modelKey.value, result)

    if (result.status === 'success') {
      handleLibrarySelect()
    }
  },
  () => missingModelUploadContext.value
)

onMounted(() => {
  if (isCloud) return

  const url = model.representative.url
  if (url && !store.fileSizes[url]) {
    fetchModelMetadata(url)
      .then((metadata) => {
        if (metadata.fileSize !== null) {
          store.setFileSize(url, metadata.fileSize)
        }
      })
      .catch((error: unknown) => {
        console.warn(
          `[MissingModelRow] Failed to fetch metadata for ${url}:`,
          error
        )
      })
  }
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

function handleLocatePrimary() {
  const ref = primaryReference.value
  if (ref) emit('locateModel', String(ref.nodeId))
}

function copyModelLink() {
  const url = model.representative.url
  copyToClipboard(url ? toBrowsableUrl(url) : model.name)
}

const {
  isSelectionConfirmable,
  cancelLibrarySelect,
  confirmLibrarySelect,
  getTypeMismatch,
  getDownloadStatus,
  handleUploadedModelImport
} = useMissingModelInteractions()

function handleToggleExpand() {
  store.modelExpandState[modelKey.value] = !expanded.value
}

watch(
  () => downloadStatus.value?.status,
  (status) => {
    if (!isCloud || status !== 'completed') return
    handleLibrarySelect()
  },
  { immediate: true }
)

function handleLibrarySelect() {
  confirmLibrarySelect(
    modelKey.value,
    model.name,
    model.referencingNodes,
    directory
  )
}
</script>
