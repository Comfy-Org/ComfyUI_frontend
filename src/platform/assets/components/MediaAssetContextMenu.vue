<template>
  <ContextMenu
    ref="contextMenu"
    :model="contextMenuItems"
    :pt="{
      root: {
        class: cn(
          'rounded-lg',
          'bg-secondary-background text-base-foreground',
          'shadow-lg'
        )
      }
    }"
  >
    <template #item="{ item, props }">
      <IconTextButton
        type="transparent"
        size="full-width"
        :label="
          typeof item.label === 'function' ? item.label() : (item.label ?? '')
        "
        v-bind="props.action"
      >
        <template #icon>
          <i :class="item.icon" class="size-4" />
        </template>
      </IconTextButton>
    </template>
  </ContextMenu>
</template>

<script setup lang="ts">
import ContextMenu from 'primevue/contextmenu'
import type { MenuItem } from 'primevue/menuitem'
import { computed, ref } from 'vue'

import IconTextButton from '@/components/button/IconTextButton.vue'
import { isCloud } from '@/platform/distribution/types'
import { supportsWorkflowMetadata } from '@/platform/workflow/utils/workflowExtractionUtil'
import { detectNodeTypeFromFilename } from '@/utils/loaderNodeUtil'
import { cn } from '@/utils/tailwindUtil'

import { useMediaAssetActions } from '../composables/useMediaAssetActions'
import type { AssetItem } from '../schemas/assetSchema'
import type { AssetContext, MediaKind } from '../schemas/mediaAssetSchema'

const { asset, assetType, fileKind, showDeleteButton } = defineProps<{
  asset: AssetItem
  assetType: AssetContext['type']
  fileKind: MediaKind
  showDeleteButton?: boolean
}>()

const emit = defineEmits<{
  zoom: []
  'asset-deleted': []
}>()

const contextMenu = ref<InstanceType<typeof ContextMenu>>()
const actions = useMediaAssetActions()

const showAddToWorkflow = computed(() => {
  // Output assets can always be added
  if (assetType === 'output') return true

  // Input assets: check if file type is supported by loader nodes
  if (assetType === 'input' && asset?.name) {
    const { nodeType } = detectNodeTypeFromFilename(asset.name)
    return nodeType !== null
  }

  return false
})

const showWorkflowActions = computed(() => {
  // Output assets always have workflow metadata
  if (assetType === 'output') return true

  // Input assets: only formats that support workflow metadata
  if (assetType === 'input' && asset?.name) {
    return supportsWorkflowMetadata(asset.name)
  }

  return false
})

const showCopyJobId = computed(() => {
  return assetType !== 'input'
})

const shouldShowDeleteButton = computed(() => {
  const propAllows = showDeleteButton ?? true
  const typeAllows =
    assetType === 'output' || (assetType === 'input' && isCloud)

  return propAllows && typeAllows
})

// Context menu items
const contextMenuItems = computed<MenuItem[]>(() => {
  if (!asset) return []

  const items: MenuItem[] = []

  // Inspect (if not 3D)
  if (fileKind !== '3D') {
    items.push({
      label: 'Inspect asset',
      icon: 'icon-[lucide--zoom-in]',
      command: () => emit('zoom')
    })
  }

  // Add to workflow (conditional)
  if (showAddToWorkflow.value) {
    items.push({
      label: 'Add to current workflow',
      icon: 'icon-[comfy--node]',
      command: () => actions.addWorkflow(asset)
    })
  }

  // Download
  items.push({
    label: 'Download',
    icon: 'icon-[lucide--download]',
    command: () => actions.downloadAsset(asset)
  })

  // Separator before workflow actions
  if (showAddToWorkflow.value || showWorkflowActions.value) {
    items.push({ separator: true })
  }

  // Workflow actions
  if (showWorkflowActions.value) {
    items.push({
      label: 'Open as workflow in new tab',
      icon: 'icon-[comfy--workflow]',
      command: () => actions.openWorkflow(asset)
    })
    items.push({
      label: 'Export workflow',
      icon: 'icon-[lucide--file-output]',
      command: () => actions.exportWorkflow(asset)
    })
  }

  // Copy job ID
  if (showCopyJobId.value) {
    if (showWorkflowActions.value) {
      items.push({ separator: true })
    }
    items.push({
      label: 'Copy job ID',
      icon: 'icon-[lucide--copy]',
      command: async () => {
        await actions.copyJobId(asset)
      }
    })
  }

  // Delete
  if (shouldShowDeleteButton.value) {
    if (showCopyJobId.value) {
      items.push({ separator: true })
    }
    items.push({
      label: 'Delete',
      icon: 'icon-[lucide--trash-2]',
      command: async () => {
        if (asset) {
          const success = await actions.confirmDelete(asset)
          if (success) {
            emit('asset-deleted')
          }
        }
      }
    })
  }

  return items
})

const show = (event: MouseEvent) => {
  contextMenu.value?.show(event)
}

const hide = () => {
  contextMenu.value?.hide()
}

defineExpose({ show, hide })
</script>
