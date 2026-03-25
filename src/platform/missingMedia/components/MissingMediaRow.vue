<template>
  <div data-testid="missing-media-row" class="flex w-full flex-col pb-3">
    <!-- File header -->
    <div class="flex h-8 w-full items-center gap-2">
      <i
        aria-hidden="true"
        class="text-foreground icon-[lucide--file] size-4 shrink-0"
      />

      <!-- Single node: show node display name instead of filename -->
      <template v-if="isSingleNode">
        <span
          v-if="showNodeIdBadge"
          class="shrink-0 rounded-md bg-secondary-background-selected px-2 py-0.5 font-mono text-xs font-bold text-muted-foreground"
        >
          #{{ item.referencingNodes[0].nodeId }}
        </span>
        <p
          class="text-foreground min-w-0 flex-1 truncate text-sm font-medium"
          :title="singleNodeLabel"
        >
          {{ singleNodeLabel }}
        </p>
      </template>

      <!-- Multiple nodes: show filename with count -->
      <p
        v-else
        class="text-foreground min-w-0 flex-1 truncate text-sm font-medium"
        :title="displayName"
      >
        {{ displayName }}
        ({{ item.referencingNodes.length }})
      </p>

      <!-- Confirm button (visible when pending selection exists) -->
      <Button
        data-testid="missing-media-confirm-button"
        variant="textonly"
        size="icon-sm"
        :aria-label="t('rightSidePanel.missingMedia.confirmSelection')"
        :disabled="!isPending"
        :class="
          cn(
            'size-8 shrink-0 rounded-lg transition-colors',
            isPending ? 'bg-primary/10 hover:bg-primary/15' : 'opacity-20'
          )
        "
        @click="confirmSelection(item.name)"
      >
        <i
          aria-hidden="true"
          class="icon-[lucide--check] size-4"
          :class="isPending ? 'text-primary' : 'text-foreground'"
        />
      </Button>

      <!-- Locate button (single node only) -->
      <Button
        v-if="isSingleNode"
        data-testid="missing-media-locate-button"
        variant="textonly"
        size="icon-sm"
        :aria-label="t('rightSidePanel.missingMedia.locateNode')"
        class="size-8 shrink-0 text-muted-foreground hover:text-base-foreground"
        @click="emit('locateNode', String(item.referencingNodes[0].nodeId))"
      >
        <i aria-hidden="true" class="icon-[lucide--locate] size-3" />
      </Button>

      <!-- Expand button (multiple nodes only) -->
      <Button
        v-if="!isSingleNode"
        variant="textonly"
        size="icon-sm"
        :aria-label="
          expanded
            ? t('rightSidePanel.missingMedia.collapseNodes')
            : t('rightSidePanel.missingMedia.expandNodes')
        "
        :aria-expanded="expanded"
        :class="
          cn(
            'size-8 shrink-0 transition-transform duration-200 hover:bg-transparent',
            expanded && 'rotate-180'
          )
        "
        @click="toggleExpand(item.name)"
      >
        <i
          aria-hidden="true"
          class="icon-[lucide--chevron-down] size-4 text-muted-foreground"
        />
      </Button>
    </div>

    <!-- Referencing nodes (expandable) -->
    <TransitionCollapse>
      <div
        v-if="expanded && item.referencingNodes.length > 1"
        class="mb-1 flex flex-col gap-0.5 overflow-hidden pl-6"
      >
        <div
          v-for="nodeRef in item.referencingNodes"
          :key="`${String(nodeRef.nodeId)}::${nodeRef.widgetName}`"
          class="flex h-7 items-center"
        >
          <span
            v-if="showNodeIdBadge"
            class="mr-1 shrink-0 rounded-md bg-secondary-background-selected px-2 py-0.5 font-mono text-xs font-bold text-muted-foreground"
          >
            #{{ nodeRef.nodeId }}
          </span>
          <p class="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {{ getNodeDisplayLabel(String(nodeRef.nodeId), item.name) }}
          </p>
          <Button
            variant="textonly"
            size="icon-sm"
            :aria-label="t('rightSidePanel.missingMedia.locateNode')"
            class="mr-1 size-8 shrink-0 text-muted-foreground hover:text-base-foreground"
            @click="emit('locateNode', String(nodeRef.nodeId))"
          >
            <i aria-hidden="true" class="icon-[lucide--locate] size-3" />
          </Button>
        </div>
      </div>
    </TransitionCollapse>

    <!-- Status card (uploading, uploaded, or library select) -->
    <TransitionCollapse>
      <div
        v-if="isPending || isUploading"
        data-testid="missing-media-status-card"
        role="status"
        aria-live="polite"
        class="bg-foreground/5 relative mt-1 overflow-hidden rounded-lg border border-interface-stroke p-2"
      >
        <div class="relative z-10 flex items-center gap-2">
          <div class="flex size-8 shrink-0 items-center justify-center">
            <i
              v-if="currentUpload?.status === 'uploading'"
              aria-hidden="true"
              class="icon-[lucide--loader-circle] size-5 animate-spin text-muted-foreground"
            />
            <i
              v-else
              aria-hidden="true"
              class="icon-[lucide--file-check] size-5 text-muted-foreground"
            />
          </div>

          <div class="flex min-w-0 flex-1 flex-col justify-center">
            <span class="text-foreground truncate text-xs/tight font-medium">
              {{ pendingDisplayName }}
            </span>
            <span class="mt-0.5 text-xs/tight text-muted-foreground">
              <template v-if="currentUpload?.status === 'uploading'">
                {{ t('rightSidePanel.missingMedia.uploading') }}
              </template>
              <template v-else-if="currentUpload?.status === 'uploaded'">
                {{ t('rightSidePanel.missingMedia.uploaded') }}
              </template>
              <template v-else>
                {{ t('rightSidePanel.missingMedia.selectedFromLibrary') }}
              </template>
            </span>
          </div>

          <Button
            data-testid="missing-media-cancel-button"
            variant="textonly"
            size="icon-sm"
            :aria-label="t('rightSidePanel.missingMedia.cancelSelection')"
            class="relative z-10 size-6 shrink-0 text-muted-foreground hover:text-base-foreground"
            @click="cancelSelection(item.name)"
          >
            <i aria-hidden="true" class="icon-[lucide--circle-x] size-4" />
          </Button>
        </div>
      </div>
    </TransitionCollapse>

    <!-- Upload + Library (when no pending selection) -->
    <TransitionCollapse>
      <div v-if="!isPending && !isUploading" class="mt-1 flex flex-col gap-1">
        <!-- Upload dropzone -->
        <div class="flex w-full flex-col py-1">
          <button
            data-testid="missing-media-upload-dropzone"
            type="button"
            :class="
              cn(
                'flex w-full cursor-pointer items-center justify-center rounded-lg border border-dashed border-component-node-border bg-transparent px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-base-foreground hover:text-base-foreground',
                isDragOver && 'border-primary text-primary'
              )
            "
            @click="openFilePicker"
            @dragover.prevent.stop="isDragOver = true"
            @dragleave.prevent.stop="isDragOver = false"
            @drop.prevent.stop="handleDrop"
          >
            {{
              t('rightSidePanel.missingMedia.uploadFile', {
                type: extensionHint
              })
            }}
          </button>
        </div>

        <!-- OR separator + Use from Library -->
        <MissingMediaLibrarySelect
          data-testid="missing-media-library-select"
          :model-value="undefined"
          :options="libraryOptions"
          :show-divider="true"
          :media-type="item.mediaType"
          @select="handleLibrarySelect(item.name, $event)"
        />
      </div>
    </TransitionCollapse>

    <!-- Hidden file input -->
    <input
      ref="fileInputRef"
      type="file"
      class="sr-only"
      :aria-label="
        t('rightSidePanel.missingMedia.uploadFile', { type: extensionHint })
      "
      :accept="acceptType"
      @change="handleFileInputChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { cn } from '@/utils/tailwindUtil'
import Button from '@/components/ui/button/Button.vue'
import TransitionCollapse from '@/components/rightSidePanel/layout/TransitionCollapse.vue'
import MissingMediaLibrarySelect from '@/platform/missingMedia/components/MissingMediaLibrarySelect.vue'
import type { MissingMediaViewModel } from '@/platform/missingMedia/types'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import {
  useMissingMediaInteractions,
  getNodeDisplayLabel,
  getMediaDisplayName
} from '@/platform/missingMedia/composables/useMissingMediaInteractions'

const { item, showNodeIdBadge } = defineProps<{
  item: MissingMediaViewModel
  showNodeIdBadge: boolean
}>()

const emit = defineEmits<{
  locateNode: [nodeId: string]
}>()

const { t } = useI18n()

const store = useMissingMediaStore()
const { uploadState, pendingSelection } = storeToRefs(store)

const {
  isExpanded,
  toggleExpand,
  getAcceptType,
  getExtensionHint,
  getLibraryOptions,
  handleLibrarySelect,
  handleUpload,
  confirmSelection,
  cancelSelection,
  hasPendingSelection
} = useMissingMediaInteractions()

const displayName = computed(() => getMediaDisplayName(item.name))
const isSingleNode = computed(() => item.referencingNodes.length === 1)
const singleNodeLabel = computed(() => {
  if (!isSingleNode.value) return ''
  const ref = item.referencingNodes[0]
  return getNodeDisplayLabel(String(ref.nodeId), item.name)
})

const expanded = computed(() => isExpanded(item.name))
const acceptType = computed(() => getAcceptType(item.mediaType))
const matchingCandidate = computed(() => {
  const candidates = store.missingMediaCandidates
  if (!candidates?.length) return null
  return candidates.find((c) => c.name === item.name) ?? null
})
const libraryOptions = computed(() => {
  const candidate = matchingCandidate.value
  if (!candidate) return []
  return getLibraryOptions(candidate)
})

const isPending = computed(() => hasPendingSelection(item.name))
const isUploading = computed(
  () => uploadState.value[item.name]?.status === 'uploading'
)
const currentUpload = computed(() => uploadState.value[item.name])
const pendingDisplayName = computed(() => {
  if (currentUpload.value) return currentUpload.value.fileName
  const pending = pendingSelection.value[item.name]
  return pending ? getMediaDisplayName(pending) : ''
})

const extensionHint = computed(() => getExtensionHint(item.mediaType))

const isDragOver = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

function openFilePicker() {
  fileInputRef.value?.click()
}

async function handleFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  try {
    if (file) {
      await handleUpload(file, item.name, item.mediaType)
    }
  } finally {
    input.value = ''
  }
}

async function handleDrop(e: DragEvent) {
  isDragOver.value = false
  const file = e.dataTransfer?.files[0]
  if (file) {
    await handleUpload(file, item.name, item.mediaType)
  }
}
</script>
