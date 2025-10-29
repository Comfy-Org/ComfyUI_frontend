<template>
  <IconGroup>
    <IconButton v-if="shouldShowDeleteButton" size="sm" @click="handleDelete">
      <i class="icon-[lucide--trash-2] size-4" />
    </IconButton>
    <IconButton size="sm" @click="handleDownload">
      <i class="icon-[lucide--download] size-4" />
    </IconButton>
    <MoreButton
      size="sm"
      @menu-opened="emit('menuStateChanged', true)"
      @menu-closed="emit('menuStateChanged', false)"
    >
      <template #default="{ close }">
        <MediaAssetMoreMenu
          :close="close"
          :show-delete-button="showDeleteButton"
          @inspect="emit('inspect')"
          @asset-deleted="emit('asset-deleted')"
        />
      </template>
    </MoreButton>
  </IconGroup>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'

import IconButton from '@/components/button/IconButton.vue'
import IconGroup from '@/components/button/IconGroup.vue'
import MoreButton from '@/components/button/MoreButton.vue'
import { isCloud } from '@/platform/distribution/types'

import { useMediaAssetActions } from '../composables/useMediaAssetActions'
import { MediaAssetKey } from '../schemas/mediaAssetSchema'
import MediaAssetMoreMenu from './MediaAssetMoreMenu.vue'

const { showDeleteButton } = defineProps<{
  showDeleteButton?: boolean
}>()

const emit = defineEmits<{
  menuStateChanged: [isOpen: boolean]
  inspect: []
  'asset-deleted': []
}>()

const { asset, context } = inject(MediaAssetKey)!
const actions = useMediaAssetActions()

const assetType = computed(() => {
  return context?.value?.type || asset.value?.tags?.[0] || 'output'
})

const shouldShowDeleteButton = computed(() => {
  const propAllows = showDeleteButton ?? true
  const typeAllows =
    assetType.value === 'output' || (assetType.value === 'input' && isCloud)

  return propAllows && typeAllows
})

const handleDelete = async () => {
  if (!asset.value) return

  const success = await actions.confirmDelete(asset.value)
  if (success) {
    emit('asset-deleted')
  }
}

const handleDownload = () => {
  if (asset.value) {
    actions.downloadAsset()
  }
}
</script>
