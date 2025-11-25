<template>
  <div class="flex flex-col">
    <!-- TODO: 3D assets currently excluded from inspection.
         When 3D loader nodes are implemented, update detectNodeTypeFromFilename
         to return appropriate node type for .gltf, .glb files and remove this exclusion -->
    <IconTextButton
      v-if="asset?.kind !== '3D'"
      type="transparent"
      :label="$t('queue.jobMenu.inspectAsset')"
      @click="handleInspect"
    >
      <template #icon>
        <i class="icon-[lucide--zoom-in] size-4" />
      </template>
    </IconTextButton>

    <IconTextButton
      v-if="showAddToWorkflow"
      type="transparent"
      :label="$t('queue.jobMenu.addToCurrentWorkflow')"
      @click="handleAddToWorkflow"
    >
      <template #icon>
        <i class="icon-[comfy--node] size-4" />
      </template>
    </IconTextButton>

    <IconTextButton
      type="transparent"
      :label="$t('queue.jobMenu.download')"
      @click="handleDownload"
    >
      <template #icon>
        <i class="icon-[lucide--download] size-4" />
      </template>
    </IconTextButton>

    <MediaAssetButtonDivider v-if="showAddToWorkflow || showWorkflowActions" />

    <IconTextButton
      v-if="showWorkflowActions"
      type="transparent"
      :label="$t('queue.jobMenu.openAsWorkflowNewTab')"
      @click="handleOpenWorkflow"
    >
      <template #icon>
        <i class="icon-[comfy--workflow] size-4" />
      </template>
    </IconTextButton>

    <IconTextButton
      v-if="showWorkflowActions"
      type="transparent"
      :label="$t('queue.jobMenu.exportWorkflow')"
      @click="handleExportWorkflow"
    >
      <template #icon>
        <i class="icon-[lucide--file-output] size-4" />
      </template>
    </IconTextButton>

    <MediaAssetButtonDivider v-if="showWorkflowActions && showCopyJobId" />

    <IconTextButton
      v-if="showCopyJobId"
      type="transparent"
      :label="$t('queue.jobMenu.copyJobId')"
      @click="handleCopyJobId"
    >
      <template #icon>
        <i class="icon-[lucide--copy] size-4" />
      </template>
    </IconTextButton>

    <MediaAssetButtonDivider v-if="showCopyJobId && shouldShowDeleteButton" />

    <IconTextButton
      v-if="shouldShowDeleteButton"
      type="transparent"
      :label="$t('queue.jobMenu.delete')"
      @click="handleDelete"
    >
      <template #icon>
        <i class="icon-[lucide--trash-2] size-4" />
      </template>
    </IconTextButton>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'

import IconTextButton from '@/components/button/IconTextButton.vue'
import { isCloud } from '@/platform/distribution/types'
import { supportsWorkflowMetadata } from '@/platform/workflow/utils/workflowExtractionUtil'
import { detectNodeTypeFromFilename } from '@/utils/loaderNodeUtil'

import { useMediaAssetActions } from '../composables/useMediaAssetActions'
import { MediaAssetKey } from '../schemas/mediaAssetSchema'
import MediaAssetButtonDivider from './MediaAssetButtonDivider.vue'

const { close, showDeleteButton } = defineProps<{
  close: () => void
  showDeleteButton?: boolean
}>()

const emit = defineEmits<{
  inspect: []
  'asset-deleted': []
}>()

const { asset, context } = inject(MediaAssetKey)!
const actions = useMediaAssetActions()

const assetType = computed(() => {
  return asset.value?.tags?.[0] || context.value?.type || 'output'
})

// Show "Add to current workflow" for all media files (images, videos, audio)
// This works for any file type that has a corresponding loader node
const showAddToWorkflow = computed(() => {
  // Output assets can always be added
  if (assetType.value === 'output') return true

  // Input assets: check if file type is supported by loader nodes
  // Use the same utility as the actual addWorkflow function for consistency
  if (assetType.value === 'input' && asset.value?.name) {
    const { nodeType } = detectNodeTypeFromFilename(asset.value.name)
    return nodeType !== null
  }

  return false
})

// Show "Open/Export workflow" only for files with workflow metadata
// This is more restrictive - only PNG, WEBP, FLAC support embedded workflows
const showWorkflowActions = computed(() => {
  // Output assets always have workflow metadata
  if (assetType.value === 'output') return true

  // Input assets: only formats that support workflow metadata
  if (assetType.value === 'input' && asset.value?.name) {
    return supportsWorkflowMetadata(asset.value.name)
  }

  return false
})

// Only show Copy Job ID for output assets (not for imported/input assets)
const showCopyJobId = computed(() => {
  return assetType.value !== 'input'
})

const shouldShowDeleteButton = computed(() => {
  const propAllows = showDeleteButton ?? true
  const typeAllows =
    assetType.value === 'output' || (assetType.value === 'input' && isCloud)

  return propAllows && typeAllows
})

const handleInspect = () => {
  emit('inspect')
  close()
}

const handleAddToWorkflow = () => {
  if (asset.value) {
    actions.addWorkflow()
  }
  close()
}

const handleDownload = () => {
  if (asset.value) {
    actions.downloadAsset()
  }
  close()
}

const handleOpenWorkflow = () => {
  if (asset.value) {
    actions.openWorkflow()
  }
  close()
}

const handleExportWorkflow = () => {
  if (asset.value) {
    actions.exportWorkflow()
  }
  close()
}

const handleCopyJobId = async () => {
  if (asset.value) {
    await actions.copyJobId()
  }
  close()
}

const handleDelete = async () => {
  if (!asset.value) return

  close() // Close the menu first

  const success = await actions.confirmDelete(asset.value)
  if (success) {
    emit('asset-deleted')
  }
}
</script>
