<template>
  <div class="asset-picker-widget">
    <div class="selected-asset-display">
      <span class="asset-name">{{ displayName }}</span>
      <Button
        icon="pi pi-search"
        class="browse-button"
        size="small"
        severity="secondary"
        @click="openAssetBrowser"
      />
    </div>

    <Dialog
      v-model:visible="showModal"
      :modal="true"
      :closable="true"
      :dismissable-mask="true"
      class="asset-browser-modal"
      :style="{ width: '80vw', height: '80vh' }"
    >
      <template #header>
        <span>{{ modalTitle }}</span>
      </template>

      <AssetBrowserDialog
        :on-close="closeAssetBrowser"
        :on-select="onAssetSelect"
      />
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { computed, ref } from 'vue'

import AssetBrowserDialog from '@/components/dialog/content/AssetBrowserDialog.vue'
import type { Asset } from '@/types/assetTypes'

export interface AssetPickerWidgetProps {
  widget: {
    value: string
    name: string
    setValue: (newValue: string) => void
  }
  nodeType?: string
  widgetName?: string
}

const props = withDefaults(defineProps<AssetPickerWidgetProps>(), {
  nodeType: '',
  widgetName: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// State
const showModal = ref(false)
const selectedAsset = ref<Asset | null>(null)

// Computed
const displayName = computed(
  () => selectedAsset.value?.name || props.widget.value || 'No model selected'
)

const modalTitle = computed(() => `Select ${props.widgetName || 'Asset'}`)

// Methods
const openAssetBrowser = () => {
  console.log('🎯 Opening asset browser for widget:', props.widget.name)
  showModal.value = true
}

const closeAssetBrowser = () => {
  console.log('🎯 closeAssetBrowser called for widget:', props.widget.name)
  console.log('🔄 Setting showModal to false...')
  showModal.value = false
  console.log(
    '✅ Modal should be closed now, showModal.value =',
    showModal.value
  )
}

const onAssetSelect = (asset: Asset) => {
  console.log('🎯 Asset selected in picker widget:', asset.name)
  selectedAsset.value = asset

  // Update widget value using proper setValue method
  const newValue = asset.filename || asset.name
  console.log('🔧 Setting widget value to:', newValue)

  // Use setValue with proper canvas context
  props.widget.setValue(newValue)
  console.log('✅ Widget value set via setValue with canvas context')

  // Emit update for Vue reactivity
  emit('update:modelValue', newValue)

  console.log('🔄 Modal should close now via onClose callback')
  // Note: Modal closes automatically via AssetBrowserDialog calling onClose
}
</script>

<style scoped>
.asset-picker-widget {
  min-height: 32px;
  display: flex;
  align-items: center;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--surface-ground);
}

.selected-asset-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  flex: 1;
}

.asset-name {
  flex: 1;
  color: var(--text-color);
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.browse-button {
  margin-left: auto;
  min-width: 32px;
}

:deep(.asset-browser-modal .p-dialog-content) {
  padding: 0 !important;
  height: calc(80vh - 60px);
  overflow: hidden;
}

:deep(.asset-browser-modal .base-widget-layout) {
  height: 100%;
  width: 100%;
  aspect-ratio: unset;
}
</style>
