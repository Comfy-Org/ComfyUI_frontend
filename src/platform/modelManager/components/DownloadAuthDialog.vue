<template>
  <Dialog v-model:open="isOpen">
    <DialogPortal>
      <DialogOverlay class="bg-black/70" />
      <DialogContent
        size="md"
        class="flex flex-col gap-4 p-6"
        @open-auto-focus="onOpen"
      >
        <DialogHeader>
          <DialogTitle>{{ $t('modelManager.downloadAuth.title') }}</DialogTitle>
          <DialogDescription>
            {{ $t('modelManager.downloadAuth.description') }}
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-2">
          <DownloadAuthProviderRow
            v-for="config in providers"
            :key="config.id"
            :provider="config.id"
            :initially-expanded="config.id === focusProvider"
          />
        </div>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogOverlay from '@/components/ui/dialog/DialogOverlay.vue'
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'

import DownloadAuthProviderRow from './DownloadAuthProviderRow.vue'
import { DOWNLOAD_PROVIDER_CONFIGS } from '../downloadAuthProviders'
import { useDownloadAuthStore } from '../stores/downloadAuthStore'
import type { DownloadProvider } from '../types'

const { focusProvider } = defineProps<{ focusProvider?: DownloadProvider }>()

const isOpen = defineModel<boolean>('open', { required: true })

const store = useDownloadAuthStore()
const providers = DOWNLOAD_PROVIDER_CONFIGS

async function onOpen() {
  await store.fetchStatus().catch(() => {})
}
</script>
