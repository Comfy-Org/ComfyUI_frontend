<template>
  <IconGroup>
    <IconButton size="sm" @click="handleDelete">
      <i class="icon-[lucide--trash-2] size-4" />
    </IconButton>
    <IconButton size="sm" @click="handleDownload">
      <i class="icon-[lucide--download] size-4" />
    </IconButton>
    <MoreButton size="sm">
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
import { MediaAssetKey } from '@/types/media.types'

import MediaAssetMoreMenu from './MediaAssetMoreMenu.vue'

const { asset, actions } = inject(MediaAssetKey)!

const handleDelete = () => {
  if (asset.value) {
    actions.onDelete(asset.value.id)
  }
}

const handleDownload = () => {
  if (asset.value) {
    actions.onDownload(asset.value.id)
  }
}
</script>
