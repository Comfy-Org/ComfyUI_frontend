<template>
  <div class="flex flex-col">
    <IconTextButton
      type="secondary"
      label="Inspect asset"
      @click="handleInspect"
    >
      <template #icon>
        <i class="icon-[lucide--zoom-in] size-4" />
      </template>
    </IconTextButton>

    <IconTextButton
      type="secondary"
      label="Add to current workflow"
      @click="handleAddToWorkflow"
    >
      <template #icon>
        <i class="icon-[comfy--node] size-4" />
      </template>
    </IconTextButton>

    <IconTextButton type="secondary" label="Download" @click="handleDownload">
      <template #icon>
        <i class="icon-[lucide--download] size-4" />
      </template>
    </IconTextButton>

    <Divider />

    <IconTextButton
      v-if="showWorkflowOptions"
      type="secondary"
      label="Open as workflow in new tab"
      @click="handleOpenWorkflow"
    >
      <template #icon>
        <i class="icon-[comfy--workflow] size-4" />
      </template>
    </IconTextButton>

    <IconTextButton
      v-if="showWorkflowOptions"
      type="secondary"
      label="Export workflow"
      @click="handleExportWorkflow"
    >
      <template #icon>
        <i class="icon-[lucide--file-output] size-4" />
      </template>
    </IconTextButton>

    <Divider v-if="showWorkflowOptions" />

    <IconTextButton
      type="secondary"
      label="Copy job ID"
      @click="handleCopyJobId"
    >
      <template #icon>
        <i class="icon-[lucide--copy] size-4" />
      </template>
    </IconTextButton>

    <Divider />

    <IconTextButton type="secondary" label="Delete" @click="handleDelete">
      <template #icon>
        <i class="icon-[lucide--trash-2] size-4" />
      </template>
    </IconTextButton>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'

import IconTextButton from '@/components/button/IconTextButton.vue'
import { MediaAssetKey } from '@/types/media.types'

import Divider from './Divider.vue'

const { close } = defineProps<{
  close: () => void
}>()

const { asset, context, actions } = inject(MediaAssetKey)!

const showWorkflowOptions = computed(() => {
  return context.value.type
})

const handleInspect = () => {
  if (asset.value) {
    actions.onView(asset.value.id)
  }
  close()
}

const handleAddToWorkflow = () => {
  if (asset.value) {
    actions.onAddToWorkflow(asset.value.id)
  }
  close()
}

const handleDownload = () => {
  if (asset.value) {
    actions.onDownload(asset.value.id)
  }
  close()
}

const handleOpenWorkflow = () => {
  if (asset.value) {
    actions.onOpenWorkflow(asset.value.id)
  }
  close()
}

const handleExportWorkflow = () => {
  if (asset.value) {
    actions.onExportWorkflow(asset.value.id)
  }
  close()
}

const handleCopyJobId = () => {
  if (asset.value) {
    actions.onCopyJobId(asset.value.id)
  }
  close()
}

const handleDelete = () => {
  if (asset.value) {
    actions.onDelete(asset.value.id)
  }
  close()
}
</script>
