<template>
  <div
    class="h-12 flex justify-between items-center px-4 text-xs text-muted font-medium leading-3"
  >
    <div v-if="nodePack.downloads" class="flex items-center gap-1.5">
      <i class="pi pi-download text-muted"></i>
      <span>{{ formattedDownloads }}</span>
    </div>
    <div class="flex justify-end items-center gap-2">
      <template v-if="!isInstalled">
        <PackInstallButton :node-packs="[nodePack]" />
      </template>
      <template v-else>
        <div
          v-if="packageConflicts"
          class="flex items-center justify-center w-6 h-6 cursor-pointer"
          @click="showConflictDetails"
        >
          <i class="pi pi-exclamation-triangle text-yellow-500 text-xl"></i>
        </div>
        <PackEnableToggle :node-pack="nodePack" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import PackEnableToggle from '@/components/dialog/content/manager/button/PackEnableToggle.vue'
import PackInstallButton from '@/components/dialog/content/manager/button/PackInstallButton.vue'
import { useDialogService } from '@/services/dialogService'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { useConflictDetectionStore } from '@/stores/conflictDetectionStore'
import type { components } from '@/types/comfyRegistryTypes'

const { nodePack } = defineProps<{
  nodePack: components['schemas']['Node']
}>()

const { isPackInstalled } = useComfyManagerStore()
const isInstalled = computed(() => isPackInstalled(nodePack?.id))

const { n } = useI18n()

const formattedDownloads = computed(() =>
  nodePack.downloads ? n(nodePack.downloads) : ''
)

const conflictStore = useConflictDetectionStore()
const { showNodeConflictDialog } = useDialogService()

const packageConflicts = computed(() => {
  if (!nodePack.id) return null

  let conflicts = conflictStore.getConflictsForPackage(nodePack.id)
  if (!conflicts && nodePack.id) {
    conflicts =
      conflictStore.conflictedPackages.find(
        (p) => p.package_id.toLowerCase() === nodePack.id?.toLowerCase()
      ) || undefined
  }
  if (!conflicts && nodePack.name) {
    conflicts =
      conflictStore.conflictedPackages.find(
        (p) => p.package_name === nodePack.name
      ) || undefined
  }
  return conflicts
})

const showConflictDetails = () => {
  if (packageConflicts.value) {
    showNodeConflictDialog({
      conflictedPackages: conflictStore.conflictedPackages
    })
  }
}
</script>
