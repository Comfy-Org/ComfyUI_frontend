<template>
  <IconGroup>
    <IconButton v-if="showDeleteButton" size="sm" @click="handleDelete">
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
          @inspect="emit('inspect')"
          @asset-deleted="emit('asset-deleted')"
        />
      </template>
    </MoreButton>
  </IconGroup>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'

import IconButton from '@/components/button/IconButton.vue'
import IconGroup from '@/components/button/IconGroup.vue'
import MoreButton from '@/components/button/MoreButton.vue'
import ConfirmationDialogContent from '@/components/dialog/content/ConfirmationDialogContent.vue'
import { isCloud } from '@/platform/distribution/types'
import { useDialogStore } from '@/stores/dialogStore'

import { useMediaAssetActions } from '../composables/useMediaAssetActions'
import { MediaAssetKey } from '../schemas/mediaAssetSchema'
import MediaAssetMoreMenu from './MediaAssetMoreMenu.vue'

const { t } = useI18n()

const emit = defineEmits<{
  menuStateChanged: [isOpen: boolean]
  inspect: []
  'asset-deleted': []
}>()

const { asset, context } = inject(MediaAssetKey)!
const actions = useMediaAssetActions()
const dialogStore = useDialogStore()

const assetType = computed(() => {
  return context?.value?.type || asset.value?.tags?.[0] || 'output'
})

const showDeleteButton = computed(() => {
  return (
    assetType.value === 'output' || (assetType.value === 'input' && isCloud)
  )
})

const handleDelete = () => {
  if (!asset.value?.id || !assetType.value) return

  dialogStore.showDialog({
    key: 'delete-asset-confirmation',
    title: t('mediaAsset.deleteAssetTitle'),
    component: ConfirmationDialogContent,
    props: {
      message: t('mediaAsset.deleteAssetDescription'),
      type: 'delete',
      itemList: [asset.value.name],
      onConfirm: async () => {
        const success = await actions.deleteAsset(asset.value!, assetType.value)
        if (success) {
          emit('asset-deleted')
        }
      }
    }
  })
}

const handleDownload = () => {
  if (asset.value) {
    actions.downloadAsset()
  }
}
</script>
