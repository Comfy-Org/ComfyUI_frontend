<template>
  <div class="mb-1 flex w-full flex-col gap-0.5 last:mb-0">
    <div
      :aria-current="highlighted ? 'true' : undefined"
      :class="
        cn(
          'flex min-h-8 items-center gap-1',
          selectionEmphasisClass(highlighted)
        )
      "
    >
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
        class="h-8 w-4 shrink-0 p-0 hover:bg-transparent focus-visible:ring-inset"
        @click="handleToggleExpand"
      >
        <i
          aria-hidden="true"
          :class="
            cn(
              'icon-[lucide--chevron-right] size-4 text-muted-foreground transition-transform duration-200',
              expanded && 'rotate-90'
            )
          "
        />
      </Button>

      <span class="flex min-w-0 flex-1 flex-col gap-0">
        <span class="flex min-w-0 items-center gap-1 text-xs/tight">
          <button
            v-if="hasModelLabelControl"
            ref="modelLabelControl"
            type="button"
            class="focus-visible:ring-ring m-0 min-w-0 cursor-pointer appearance-none rounded-sm border-0 bg-transparent p-0 text-left font-normal wrap-break-word text-base-foreground outline-none hover:text-base-foreground focus:outline-none focus-visible:ring-1 focus-visible:outline-none focus-visible:ring-inset"
            :title="displayModelName"
            @click="handleModelLabelClick"
          >
            {{ displayModelName }}
          </button>
          <span
            v-else
            class="min-w-0 font-normal wrap-break-word text-base-foreground"
            :title="displayModelName"
          >
            {{ displayModelName }}
          </span>
          <span
            v-if="hasMultipleReferences"
            data-testid="missing-model-reference-count"
            class="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-sm bg-secondary-background-hover px-1 text-2xs font-semibold text-base-foreground"
          >
            {{ model.referencingNodes.length }}
          </span>
          <Button
            variant="textonly"
            size="icon-sm"
            class="size-6 shrink-0 text-muted-foreground hover:bg-transparent hover:text-base-foreground focus-visible:ring-inset"
            :aria-label="linkLabel"
            :title="linkLabel"
            @click="copyModelLink"
          >
            <i aria-hidden="true" class="icon-[lucide--link] size-4" />
          </Button>
        </span>
        <span
          v-if="modelMetadataLabel"
          class="block text-2xs/tight"
          :class="
            isUnknownCategory
              ? 'text-warning-background'
              : 'text-muted-foreground'
          "
        >
          {{ modelMetadataLabel }}
        </span>
      </span>

      <template v-if="isCloud && canCloudImport">
        <Button
          v-if="!isCloudImportDownloadActive"
          data-testid="missing-model-import"
          variant="secondary"
          size="sm"
          class="shrink-0 focus-visible:ring-inset"
          @click="showUploadDialog"
        >
          {{ t('g.import') }}
        </Button>
        <div
          v-else
          ref="cloudProgress"
          role="progressbar"
          :aria-label="t('rightSidePanel.missingModels.importing')"
          :aria-valuenow="cloudImportProgressPercent"
          aria-valuemin="0"
          aria-valuemax="100"
          tabindex="-1"
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
        <span
          v-if="isCloudImportDownloadActive"
          role="status"
          aria-live="polite"
          class="sr-only"
        >
          {{ t('rightSidePanel.missingModels.importing') }}
        </span>
      </template>

      <template v-else>
        <Button
          v-if="showGatedRepoAction"
          data-testid="missing-model-gated-access"
          variant="muted-textonly"
          size="icon"
          class="size-8 shrink-0 text-warning-background hover:text-warning-background focus-visible:ring-inset"
          :aria-label="`${t('rightSidePanel.missingModels.openHuggingFaceRepo')} ${model.name}`"
          :title="gatedModelTooltip"
          @click="handleOpenGatedRepo"
        >
          <i aria-hidden="true" class="icon-[lucide--lock] size-4" />
        </Button>
        <Button
          v-if="showDownloadAction"
          data-testid="missing-model-download"
          variant="secondary"
          size="sm"
          class="shrink-0 focus-visible:ring-inset"
          :aria-label="`${t('g.download')} ${model.name}`"
          :aria-describedby="
            showGatedRepoAction ? gatedDownloadDescriptionId : undefined
          "
          :title="gatedModelDownloadTooltip"
          @click="handleDownload"
        >
          {{ t('g.download') }}
        </Button>
        <span
          v-if="showGatedRepoAction"
          :id="gatedDownloadDescriptionId"
          hidden
        >
          {{ gatedModelDownloadTooltip }}
        </span>
      </template>

      <Button
        v-if="!hasMultipleReferences && !isUnknownCategory && primaryReference"
        data-testid="missing-model-locate"
        variant="textonly"
        size="icon-sm"
        :aria-label="t('rightSidePanel.missingModels.locateNode')"
        class="size-8 shrink-0 text-muted-foreground hover:text-base-foreground focus-visible:ring-inset"
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
            'm-0 list-none p-0',
            (hasMultipleReferences || isUnknownCategory) && 'pl-5'
          )
        "
      >
        <li
          v-for="ref in model.referencingNodes"
          :key="`${String(ref.nodeId)}::${ref.widgetName}`"
          class="min-w-0"
        >
          <div class="flex min-h-8 min-w-0 items-center gap-2">
            <button
              type="button"
              class="focus-visible:ring-ring m-0 inline max-w-full cursor-pointer appearance-none rounded-sm border-0 bg-transparent p-0 text-left text-xs/tight font-normal wrap-break-word text-muted-foreground outline-none hover:text-base-foreground focus:outline-none focus-visible:ring-1 focus-visible:outline-none focus-visible:ring-inset"
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
              class="ml-auto size-8 shrink-0 text-muted-foreground hover:text-base-foreground focus-visible:ring-inset"
              @click="emit('locateModel', String(ref.nodeId))"
            >
              <i aria-hidden="true" class="icon-[lucide--locate] size-4" />
            </Button>
          </div>
        </li>
      </ul>
    </TransitionCollapse>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  useId,
  useTemplateRef,
  watch
} from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { cn } from '@comfyorg/tailwind-utils'

import { selectionEmphasisClass } from '@/components/rightSidePanel/errors/selectionEmphasis'
import Button from '@/components/ui/button/Button.vue'
import TransitionCollapse from '@/components/rightSidePanel/layout/TransitionCollapse.vue'
import type { MissingModelViewModel } from '@/platform/missingModel/types'
import type { UploadModelDialogContext } from '@/platform/assets/composables/useUploadModelWizard'

import { useModelUpload } from '@/platform/assets/composables/useModelUpload'
import {
  useMissingModelInteractions,
  getModelStateKey,
  getNodeDisplayLabel
} from '@/platform/missingModel/composables/useMissingModelInteractions'
import { useMissingModelDownload } from '@/platform/missingModel/composables/useMissingModelDownload'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { isCloud } from '@/platform/distribution/types'
import {
  isModelDownloadable,
  toBrowsableUrl
} from '@/platform/missingModel/missingModelDownload'
import { formatSize } from '@/utils/formatUtil'

const {
  model,
  directory,
  isAssetSupported,
  canCloudImport = true,
  highlighted
} = defineProps<{
  model: MissingModelViewModel
  directory: string | null
  isAssetSupported: boolean
  canCloudImport?: boolean
  /** Emphasize the header row (model referenced by the canvas selection). */
  highlighted?: boolean
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
const isUnknownCategory = computed(() => directory === null)
const isDownloadActive = computed(
  () =>
    downloadStatus.value?.status === 'running' ||
    downloadStatus.value?.status === 'created'
)
const isCloudImportDownloadActive = computed(
  () => isCloud && canCloudImport && isDownloadActive.value
)
const cloudImportProgressPercent = computed(() =>
  Math.round((downloadStatus.value?.progress ?? 0) * 100)
)
const hasMultipleReferences = computed(() => model.referencingNodes.length > 1)
const primaryReference = computed(() => model.referencingNodes[0])
const hasModelLabelControl = computed(
  () =>
    hasMultipleReferences.value ||
    (!isUnknownCategory.value && !!primaryReference.value)
)
const linkLabel = computed(() =>
  model.representative.url
    ? t('rightSidePanel.missingModels.copyUrl')
    : t('rightSidePanel.missingModels.copyModelName')
)

const store = useMissingModelStore()
const { selectedLibraryModel } = storeToRefs(store)
const cloudProgress = useTemplateRef<HTMLElement>('cloudProgress')
const modelLabelControl = useTemplateRef<HTMLButtonElement>('modelLabelControl')
const { prefetchModelMetadata, downloadMissingModel, openModelAccessPage } =
  useMissingModelDownload()

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
    rep.url &&
    rep.directory &&
    isModelDownloadable({
      name: rep.name,
      url: rep.url,
      directory: rep.directory
    })
  )
})

const showDownloadAction = computed(() => !isCloud && downloadable.value)
const gatedRepoUrl = computed(() => {
  const url = model.representative.url
  return url ? store.gatedRepoUrls[url] : undefined
})
const showGatedRepoAction = computed(
  () => showDownloadAction.value && !!gatedRepoUrl.value
)
const gatedModelTooltip = computed(() =>
  showGatedRepoAction.value
    ? t('rightSidePanel.missingModels.gatedModelTooltip')
    : undefined
)
const gatedModelDownloadTooltip = computed(() =>
  showGatedRepoAction.value
    ? t('rightSidePanel.missingModels.gatedModelDownloadTooltip')
    : undefined
)
const gatedDownloadDescriptionId = useId()

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
  if (!canCloudImport || !directory) return undefined

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
  if (url && downloadable.value) {
    void prefetchModelMetadata(url)
  }
})

function handleDownload() {
  const rep = model.representative
  if (rep.url && rep.directory) {
    downloadMissingModel({
      name: rep.name,
      url: rep.url,
      directory: rep.directory
    })
  } else {
    console.warn('[MissingModelRow] Cannot download: missing url or directory')
  }
}

function handleOpenGatedRepo() {
  const repoUrl = gatedRepoUrl.value
  if (repoUrl) void openModelAccessPage(repoUrl)
}

function handleLocatePrimary() {
  const ref = primaryReference.value
  if (ref) emit('locateModel', String(ref.nodeId))
}

function copyModelLink() {
  const url = model.representative.url
  copyToClipboard(url ? toBrowsableUrl(url) : model.name)
}

const { confirmLibrarySelect, getDownloadStatus, handleUploadedModelImport } =
  useMissingModelInteractions()

function handleToggleExpand() {
  store.modelExpandState[modelKey.value] = !expanded.value
}

function handleModelLabelClick() {
  if (hasMultipleReferences.value) {
    handleToggleExpand()
    return
  }

  handleLocatePrimary()
}

watch(
  () => downloadStatus.value?.status,
  (status) => {
    if (!isCloud || status !== 'completed') return
    const completedAssetName = downloadStatus.value?.assetName
    if (completedAssetName) {
      selectedLibraryModel.value[modelKey.value] = completedAssetName
    }
    handleLibrarySelect()
  },
  { immediate: true }
)

watch(isCloudImportDownloadActive, async (isActive, wasActive) => {
  await nextTick()
  if (isActive) {
    cloudProgress.value?.focus()
  } else if (wasActive) {
    modelLabelControl.value?.focus()
  }
})

function handleLibrarySelect() {
  confirmLibrarySelect(
    modelKey.value,
    model.name,
    model.referencingNodes,
    directory
  )
}
</script>
