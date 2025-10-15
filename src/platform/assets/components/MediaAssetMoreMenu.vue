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

    <MediaAssetButtonDivider />

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

    <MediaAssetButtonDivider v-if="showWorkflowOptions" />

    <IconTextButton
      type="transparent"
      class="dark-theme:text-white"
      label="Copy job ID"
      @click="handleCopyJobId"
    >
      <template #icon>
        <i class="icon-[lucide--copy] size-4" />
      </template>
    </IconTextButton>

    <MediaAssetButtonDivider />

    <IconTextButton
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

import { useMediaAssetActions } from '../composables/useMediaAssetActions'
import { useMediaAssetGalleryStore } from '../composables/useMediaAssetGalleryStore'
import { MediaAssetKey } from '../schemas/mediaAssetSchema'
import MediaAssetButtonDivider from './MediaAssetButtonDivider.vue'

const { close } = defineProps<{
  close: () => void
}>()

const { asset, context } = inject(MediaAssetKey)!
const actions = useMediaAssetActions()
const galleryStore = useMediaAssetGalleryStore()

const showWorkflowOptions = computed(() => context.value.type)

const handleInspect = () => {
  if (asset.value) {
    galleryStore.openSingle(asset.value)
  }
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
    actions.downloadAsset(asset.value.id)
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

const handleCopyJobId = () => {
  if (asset.value) {
    actions.copyAssetUrl(asset.value.id)
  }
  close()
}

const handleDelete = () => {
  if (asset.value) {
    actions.deleteAsset(asset.value.id)
  }
  close()
}
</script>
