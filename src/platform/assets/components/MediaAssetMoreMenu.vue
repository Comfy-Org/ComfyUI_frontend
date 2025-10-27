<template>
  <div class="flex flex-col">
    <IconTextButton
      v-if="asset?.kind !== '3D'"
      type="transparent"
      class="dark-theme:text-white"
      label="Inspect asset"
      @click="handleInspect"
    >
      <template #icon>
        <i class="icon-[lucide--zoom-in] size-4" />
      </template>
    </IconTextButton>

    <IconTextButton
      v-if="showWorkflowOptions"
      type="transparent"
      class="dark-theme:text-white"
      label="Add to current workflow"
      @click="handleAddToWorkflow"
    >
      <template #icon>
        <i class="icon-[comfy--node] size-4" />
      </template>
    </IconTextButton>

    <IconTextButton
      type="transparent"
      class="dark-theme:text-white"
      label="Download"
      @click="handleDownload"
    >
      <template #icon>
        <i class="icon-[lucide--download] size-4" />
      </template>
    </IconTextButton>

    <MediaAssetButtonDivider v-if="showWorkflowOptions" />

    <IconTextButton
      v-if="showWorkflowOptions"
      type="transparent"
      class="dark-theme:text-white"
      label="Open as workflow in new tab"
      @click="handleOpenWorkflow"
    >
      <template #icon>
        <i class="icon-[comfy--workflow] size-4" />
      </template>
    </IconTextButton>

    <IconTextButton
      v-if="showWorkflowOptions"
      type="transparent"
      class="dark-theme:text-white"
      label="Export workflow"
      @click="handleExportWorkflow"
    >
      <template #icon>
        <i class="icon-[lucide--file-output] size-4" />
      </template>
    </IconTextButton>

    <MediaAssetButtonDivider v-if="showWorkflowOptions && showCopyJobId" />

    <IconTextButton
      v-if="showCopyJobId"
      type="transparent"
      class="dark-theme:text-white"
      label="Copy job ID"
      @click="handleCopyJobId"
    >
      <template #icon>
        <i class="icon-[lucide--copy] size-4" />
      </template>
    </IconTextButton>

    <MediaAssetButtonDivider v-if="showCopyJobId && showDeleteButton" />

    <IconTextButton
      v-if="showDeleteButton"
      type="transparent"
      class="dark-theme:text-white"
      label="Delete"
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

import { useMediaAssetActions } from '../composables/useMediaAssetActions'
import { MediaAssetKey } from '../schemas/mediaAssetSchema'
import MediaAssetButtonDivider from './MediaAssetButtonDivider.vue'

const { close } = defineProps<{
  close: () => void
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

const showWorkflowOptions = computed(() => assetType.value === 'output')

// Only show Copy Job ID for output assets (not for imported/input assets)
const showCopyJobId = computed(() => {
  return assetType.value !== 'input'
})

// Delete button should be shown for:
// - All output files (can be deleted via history)
// - Input files only in cloud environment
const showDeleteButton = computed(() => {
  return (
    assetType.value === 'output' || (assetType.value === 'input' && isCloud)
  )
})

const handleInspect = () => {
  emit('inspect')
  close()
}

const handleAddToWorkflow = () => {
  if (asset.value) {
    actions.addWorkflow(asset.value.id)
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
    actions.openWorkflow(asset.value.id)
  }
  close()
}

const handleExportWorkflow = () => {
  if (asset.value) {
    actions.exportWorkflow(asset.value.id)
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
