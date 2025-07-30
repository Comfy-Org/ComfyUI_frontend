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
        <PackInstallButton
          :node-packs="[nodePack]"
          :has-conflict="hasConflict"
        />
      </template>
      <template v-else>
        <PackEnableToggle :node-pack="nodePack" :has-conflict="hasConflict" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import PackEnableToggle from '@/components/dialog/content/manager/button/PackEnableToggle.vue'
import PackInstallButton from '@/components/dialog/content/manager/button/PackInstallButton.vue'
import { useConflictDetection } from '@/composables/useConflictDetection'
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

const { getConflictsForPackageByID } = useConflictDetectionStore()
const { checkVersionCompatibility } = useConflictDetection()

const hasConflict = computed(() => {
  if (!nodePack.id) return false

  // For installed packages, check conflicts from store
  if (isInstalled.value) {
    // Try exact match first
    let conflicts = getConflictsForPackageByID(nodePack.id)
    if (conflicts) return true

    return false
  }

  // For uninstalled packages, check compatibility directly
  const compatibility = checkVersionCompatibility(nodePack)
  console.log(compatibility)

  return compatibility.hasConflict
})
</script>
