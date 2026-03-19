<template>
  <div
    class="media-asset-menu-panel flex min-w-56 flex-col rounded-lg border border-border-subtle bg-secondary-background p-2 text-base-foreground"
  >
    <template v-for="item in contextMenuItems" :key="item.key">
      <div v-if="item.kind === 'divider'" class="m-1 h-px bg-border-subtle" />
      <Button
        v-else
        variant="secondary"
        size="sm"
        class="w-full justify-start"
        :disabled="item.disabled"
        @click="onItemSelect(item)"
      >
        <i v-if="item.icon" :class="item.icon" class="size-4" />
        <span>{{ item.label }}</span>
      </Button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import {
  injectContextMenuRootContext,
  injectDropdownMenuRootContext
} from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { isCloud } from '@/platform/distribution/types'
import { supportsWorkflowMetadata } from '@/platform/workflow/utils/workflowExtractionUtil'
import { isPreviewableMediaType } from '@/utils/formatUtil'
import { detectNodeTypeFromFilename } from '@/utils/loaderNodeUtil'

import { useMediaAssetActions } from '../composables/useMediaAssetActions'
import type { AssetItem } from '../schemas/assetSchema'
import type { AssetContext, MediaKind } from '../schemas/mediaAssetSchema'

const {
  asset,
  assetType,
  fileKind,
  showDeleteButton,
  selectedAssets,
  isBulkMode,
  closeOnScroll
} = defineProps<{
  asset: AssetItem
  assetType: AssetContext['type']
  fileKind: MediaKind
  showDeleteButton?: boolean
  selectedAssets?: AssetItem[]
  isBulkMode?: boolean
  closeOnScroll?: boolean
}>()

const emit = defineEmits<{
  zoom: []
  'asset-deleted': []
  'bulk-download': [assets: AssetItem[]]
  'bulk-delete': [assets: AssetItem[]]
  'bulk-add-to-workflow': [assets: AssetItem[]]
  'bulk-open-workflow': [assets: AssetItem[]]
  'bulk-export-workflow': [assets: AssetItem[]]
}>()

type ContextMenuItem =
  | {
      kind?: 'item'
      key: string
      label: string
      icon?: string
      disabled?: boolean
      onSelect?: () => void | Promise<void>
    }
  | {
      kind: 'divider'
      key: string
    }

const actions = useMediaAssetActions()
const { t } = useI18n()
const dropdownMenuRootContext = injectDropdownMenuRootContext(null)
const contextMenuRootContext = injectContextMenuRootContext(null)

function closeMenu() {
  dropdownMenuRootContext?.onOpenChange(false)
  contextMenuRootContext?.onOpenChange(false)
}

useEventListener(
  window,
  'scroll',
  () => {
    if (closeOnScroll) {
      closeMenu()
    }
  },
  { capture: true, passive: true }
)

function canAddToWorkflow(candidate: AssetItem): boolean {
  if (assetType === 'output') return true

  if (assetType === 'input' && candidate.name) {
    const { nodeType } = detectNodeTypeFromFilename(candidate.name)
    return nodeType !== null
  }

  return false
}

function canShowWorkflowActions(candidate: AssetItem): boolean {
  if (assetType === 'output') return true

  if (assetType === 'input' && candidate.name) {
    return supportsWorkflowMetadata(candidate.name)
  }

  return false
}

const showAddToWorkflow = computed(() => {
  return asset ? canAddToWorkflow(asset) : false
})

const showWorkflowActions = computed(() => {
  return asset ? canShowWorkflowActions(asset) : false
})

const showCopyJobId = computed(() => assetType !== 'input')

const allSelectedCanAddToWorkflow = computed(() => {
  return selectedAssets?.every(canAddToWorkflow) ?? false
})

const allSelectedShowWorkflowActions = computed(() => {
  return selectedAssets?.every(canShowWorkflowActions) ?? false
})

const shouldShowDeleteButton = computed(() => {
  const propAllows = showDeleteButton ?? true
  const typeAllows =
    assetType === 'output' || (assetType === 'input' && isCloud)

  return propAllows && typeAllows
})

const contextMenuItems = computed<ContextMenuItem[]>(() => {
  if (!asset) return []

  const items: ContextMenuItem[] = []
  const isCurrentAssetSelected = selectedAssets?.some(
    (selectedAsset) => selectedAsset.id === asset.id
  )

  if (
    isBulkMode &&
    selectedAssets &&
    selectedAssets.length > 0 &&
    isCurrentAssetSelected
  ) {
    items.push({
      key: 'bulk-selection-header',
      label: t('mediaAsset.selection.multipleSelectedAssets'),
      disabled: true
    })

    if (allSelectedCanAddToWorkflow.value) {
      items.push({
        key: 'bulk-add-to-workflow',
        label: t('mediaAsset.selection.insertAllAssetsAsNodes'),
        icon: 'icon-[comfy--node]',
        onSelect: () => emit('bulk-add-to-workflow', selectedAssets)
      })
    }

    if (allSelectedShowWorkflowActions.value) {
      items.push({
        key: 'bulk-open-workflow',
        label: t('mediaAsset.selection.openWorkflowAll'),
        icon: 'icon-[comfy--workflow]',
        onSelect: () => emit('bulk-open-workflow', selectedAssets)
      })
      items.push({
        key: 'bulk-export-workflow',
        label: t('mediaAsset.selection.exportWorkflowAll'),
        icon: 'icon-[lucide--file-output]',
        onSelect: () => emit('bulk-export-workflow', selectedAssets)
      })
    }

    items.push({
      key: 'bulk-download',
      label: t('mediaAsset.selection.downloadSelectedAll'),
      icon: 'icon-[lucide--download]',
      onSelect: () => emit('bulk-download', selectedAssets)
    })

    if (shouldShowDeleteButton.value) {
      items.push({
        key: 'bulk-delete',
        label: t('mediaAsset.selection.deleteSelectedAll'),
        icon: 'icon-[lucide--trash-2]',
        onSelect: () => emit('bulk-delete', selectedAssets)
      })
    }

    return items
  }

  if (isPreviewableMediaType(fileKind)) {
    items.push({
      key: 'inspect',
      label: t('mediaAsset.actions.inspect'),
      icon: 'icon-[lucide--zoom-in]',
      onSelect: () => emit('zoom')
    })
  }

  if (showAddToWorkflow.value) {
    items.push({
      key: 'add-to-workflow',
      label: t('mediaAsset.actions.insertAsNodeInWorkflow'),
      icon: 'icon-[comfy--node]',
      onSelect: () => actions.addWorkflow(asset)
    })
  }

  items.push({
    key: 'download',
    label: t('mediaAsset.actions.download'),
    icon: 'icon-[lucide--download]',
    onSelect: () => actions.downloadAsset(asset)
  })

  if (showWorkflowActions.value) {
    items.push({ kind: 'divider', key: 'workflow-divider' })
    items.push({
      key: 'open-workflow',
      label: t('mediaAsset.actions.openWorkflow'),
      icon: 'icon-[comfy--workflow]',
      onSelect: () => actions.openWorkflow(asset)
    })
    items.push({
      key: 'export-workflow',
      label: t('mediaAsset.actions.exportWorkflow'),
      icon: 'icon-[lucide--file-output]',
      onSelect: () => actions.exportWorkflow(asset)
    })
  }

  if (showCopyJobId.value) {
    items.push({ kind: 'divider', key: 'copy-job-id-divider' })
    items.push({
      key: 'copy-job-id',
      label: t('mediaAsset.actions.copyJobId'),
      icon: 'icon-[lucide--copy]',
      onSelect: async () => {
        await actions.copyJobId(asset)
      }
    })
  }

  if (shouldShowDeleteButton.value) {
    items.push({ kind: 'divider', key: 'delete-divider' })
    items.push({
      key: 'delete',
      label: t('mediaAsset.actions.delete'),
      icon: 'icon-[lucide--trash-2]',
      onSelect: async () => {
        const confirmed = await actions.deleteAssets(asset)
        if (confirmed) {
          emit('asset-deleted')
        }
      }
    })
  }

  return items
})

async function onItemSelect(item: ContextMenuItem) {
  if (item.kind === 'divider' || item.disabled) {
    return
  }

  closeMenu()
  await item.onSelect?.()
}
</script>
