<template>
  <IconGroup>
    <IconButton size="sm" @click="handleDelete">
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
        <MediaAssetMoreMenu :close="close" />
      </template>
    </MoreButton>
  </IconGroup>
</template>

<script setup lang="ts">
import { inject } from 'vue'

import IconButton from '@/components/button/IconButton.vue'
import IconGroup from '@/components/button/IconGroup.vue'
import MoreButton from '@/components/button/MoreButton.vue'

import { useMediaAssetActions } from '../composables/useMediaAssetActions'
import { MediaAssetKey } from '../schemas/mediaAssetSchema'
import MediaAssetMoreMenu from './MediaAssetMoreMenu.vue'

const emit = defineEmits<{
  menuStateChanged: [isOpen: boolean]
}>()

const { asset } = inject(MediaAssetKey)!
const actions = useMediaAssetActions()

const handleDelete = () => {
  if (asset.value) {
    actions.deleteAsset(asset.value.id)
  }
}

const handleDownload = () => {
  if (asset.value) {
    actions.downloadAsset(asset.value.id)
  }
}
</script>
