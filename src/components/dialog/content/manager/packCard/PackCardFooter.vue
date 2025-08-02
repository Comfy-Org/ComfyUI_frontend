<template>
  <div
    class="h-12 flex justify-between items-center px-4 text-xs text-muted font-medium leading-3"
  >
    <div v-if="nodePack.downloads" class="flex items-center gap-1.5">
      <i class="pi pi-download text-muted"></i>
      <span>{{ formattedDownloads }}</span>
    </div>
    <div class="flex justify-end items-center gap-2">
      <template v-if="importFailed">
        <div
          class="flex justify-center items-center gap-2 cursor-pointer"
          @click="showImportFailedDialog"
        >
          <i class="pi pi-exclamation-triangle text-red-500 text-sm"></i>
          <span class="text-red-500 text-xs pt-0.5">{{
            t('manager.failedToInstall')
          }}</span>
        </div>
      </template>
      <template v-else>
        <template v-if="!isInstalled">
          <PackInstallButton
            :node-packs="[nodePack]"
            :is-installing="isInstalling"
            :has-conflict="uninstalledPackConflict.hasConflict"
            :conflict-info="uninstalledPackConflict.conflicts"
          />
        </template>
        <template v-else>
          <PackEnableToggle
            :node-pack="nodePack"
            :has-conflict="installedPackHasConflict"
          />
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'

import PackEnableToggle from '@/components/dialog/content/manager/button/PackEnableToggle.vue'
import PackInstallButton from '@/components/dialog/content/manager/button/PackInstallButton.vue'
import { useConflictDetection } from '@/composables/useConflictDetection'
import { useImportFailedDetection } from '@/composables/useImportFailedDetection'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { useConflictDetectionStore } from '@/stores/conflictDetectionStore'
import { IsInstallingKey } from '@/types/comfyManagerTypes'
import type { components } from '@/types/comfyRegistryTypes'

const { nodePack } = defineProps<{
  nodePack: components['schemas']['Node']
}>()

const { isPackInstalled } = useComfyManagerStore()
const isInstalled = computed(() => isPackInstalled(nodePack?.id))
const isInstalling = inject(IsInstallingKey)

const { n, t } = useI18n()

const formattedDownloads = computed(() =>
  nodePack.downloads ? n(nodePack.downloads) : ''
)

const { getConflictsForPackageByID } = useConflictDetectionStore()
const { checkNodeCompatibility } = useConflictDetection()

const { importFailed, showImportFailedDialog } = useImportFailedDetection(
  nodePack.id
)

const conflicts = computed(
  () => getConflictsForPackageByID(nodePack.id!) || null
)

const installedPackHasConflict = computed(() => {
  if (!nodePack.id) return false
  return !!conflicts.value
})

const uninstalledPackConflict = computed(() => {
  return checkNodeCompatibility(nodePack)
})
</script>
