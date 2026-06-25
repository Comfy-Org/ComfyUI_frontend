<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'
import DropdownMenuSeparator from '@/components/ui/dropdown-menu/DropdownMenuSeparator.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu/DropdownMenuTrigger.vue'
import { isCloud } from '@/platform/distribution/types'
import { supportsWorkflowMetadata } from '@/platform/workflow/utils/workflowExtractionUtil'
import { isPreviewableMediaType } from '@/utils/formatUtil'
import { detectNodeTypeFromFilename } from '@/utils/loaderNodeUtil'

import { useMediaAssetActions } from '../composables/useMediaAssetActions'
import type { AssetItem } from '../schemas/assetSchema'
import type { AssetContext, MediaKind } from '../schemas/mediaAssetSchema'

type ContextMenuItem = {
  separator?: boolean
  label?: string
  icon?: string
  disabled?: boolean
  command?: () => unknown
}

const {
  asset,
  assetType,
  fileKind,
  showDeleteButton,
  selectedAssets,
  isBulkMode
} = defineProps<{
  asset: AssetItem
  assetType: AssetContext['type']
  fileKind: MediaKind
  showDeleteButton?: boolean
  selectedAssets?: AssetItem[]
  isBulkMode?: boolean
}>()

const emit = defineEmits<{
  zoom: []
  hide: []
  'asset-deleted': []
  'bulk-download': [assets: AssetItem[]]
  'bulk-delete': [assets: AssetItem[]]
  'bulk-add-to-workflow': [assets: AssetItem[]]
  'bulk-open-workflow': [assets: AssetItem[]]
  'bulk-export-workflow': [assets: AssetItem[]]
}>()

const isOpen = ref(false)
const anchor = ref({ x: 0, y: 0 })
const actions = useMediaAssetActions()
const { t } = useI18n()

const showAddToWorkflow = computed(() => {
  if (assetType === 'output') return true
  if (assetType === 'input' && asset?.name) {
    const { nodeType } = detectNodeTypeFromFilename(asset.name)
    return nodeType !== null
  }
  return false
})

const showWorkflowActions = computed(() => {
  if (assetType === 'output') return true
  if (assetType === 'input' && asset?.name) {
    return supportsWorkflowMetadata(asset.name)
  }
  return false
})

const showCopyJobId = computed(() => assetType !== 'input')

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
      label: t('mediaAsset.selection.multipleSelectedAssets'),
      disabled: true
    })
    items.push({
      label: t('mediaAsset.selection.insertAllAssetsAsNodes'),
      icon: 'icon-[comfy--node]',
      command: () => emit('bulk-add-to-workflow', selectedAssets)
    })
    items.push({
      label: t('mediaAsset.selection.openWorkflowAll'),
      icon: 'icon-[comfy--workflow]',
      command: () => emit('bulk-open-workflow', selectedAssets)
    })
    items.push({
      label: t('mediaAsset.selection.exportWorkflowAll'),
      icon: 'icon-[lucide--file-output]',
      command: () => emit('bulk-export-workflow', selectedAssets)
    })
    items.push({
      label: t('mediaAsset.selection.downloadSelectedAll'),
      icon: 'icon-[lucide--download]',
      command: () => emit('bulk-download', selectedAssets)
    })
    if (shouldShowDeleteButton.value) {
      items.push({
        label: t('mediaAsset.selection.deleteSelectedAll'),
        icon: 'icon-[lucide--trash-2]',
        command: () => emit('bulk-delete', selectedAssets)
      })
    }
    return items
  }

  if (isPreviewableMediaType(fileKind)) {
    items.push({
      label: t('mediaAsset.actions.inspect'),
      icon: 'icon-[lucide--zoom-in]',
      command: () => emit('zoom')
    })
  }

  if (showAddToWorkflow.value) {
    items.push({
      label: t('mediaAsset.actions.insertAsNodeInWorkflow'),
      icon: 'icon-[comfy--node]',
      command: () => actions.addWorkflow(asset)
    })
  }

  items.push({
    label: t('mediaAsset.actions.download'),
    icon: 'icon-[lucide--download]',
    command: () => actions.downloadAssets([asset])
  })

  if (showWorkflowActions.value) {
    items.push({ separator: true })
    items.push({
      label: t('mediaAsset.actions.openWorkflow'),
      icon: 'icon-[comfy--workflow]',
      command: () => actions.openWorkflow(asset)
    })
    items.push({
      label: t('mediaAsset.actions.exportWorkflow'),
      icon: 'icon-[lucide--file-output]',
      command: () => actions.exportWorkflow(asset)
    })
  }

  if (showCopyJobId.value) {
    items.push({ separator: true })
    items.push({
      label: t('mediaAsset.actions.copyJobId'),
      icon: 'icon-[lucide--copy]',
      command: async () => {
        await actions.copyJobId(asset)
      }
    })
  }

  if (shouldShowDeleteButton.value) {
    items.push({ separator: true })
    items.push({
      label: t('mediaAsset.actions.delete'),
      icon: 'icon-[lucide--trash-2]',
      command: async () => {
        if (asset) {
          const confirmed = await actions.deleteAssets(asset)
          if (confirmed) {
            emit('asset-deleted')
          }
        }
      }
    })
  }

  return items
})

async function show(event: MouseEvent) {
  anchor.value = { x: event.clientX, y: event.clientY }
  if (isOpen.value) {
    isOpen.value = false
    await nextTick()
  }
  isOpen.value = true
}

function hide() {
  isOpen.value = false
}

function onOpenChange(open: boolean) {
  if (!open) emit('hide')
}

function runCommand(item: ContextMenuItem) {
  if (item.separator || item.disabled) return
  void item.command?.()
}

defineExpose({ show, hide })
</script>

<template>
  <DropdownMenu
    v-model:open="isOpen"
    :modal="false"
    @update:open="onOpenChange"
  >
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        aria-hidden="true"
        tabindex="-1"
        class="pointer-events-none fixed size-0 opacity-0"
        :style="{ left: `${anchor.x}px`, top: `${anchor.y}px` }"
      />
    </DropdownMenuTrigger>
    <DropdownMenuContent
      size="lg"
      :side-offset="0"
      align="start"
      :collision-padding="8"
    >
      <template v-for="(item, index) in contextMenuItems" :key="index">
        <DropdownMenuSeparator v-if="item.separator" />
        <DropdownMenuItem
          v-else
          :disabled="item.disabled"
          @select="runCommand(item)"
        >
          <template v-if="item.icon" #icon>
            <i :class="item.icon" />
          </template>
          {{ item.label }}
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
