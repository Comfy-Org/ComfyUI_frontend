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

const conflictStore = useConflictDetectionStore()
const { checkVersionCompatibility } = useConflictDetection()

// TODO: Package version mismatch issue - Package IDs include version suffixes (@1_0_3)
// but UI searches without version. This causes conflict detection failures.
// Once getConflictsForPackage is improved to handle version matching properly,
// all the complex fallback logic below can be removed.
const hasConflict = computed(() => {
  if (!nodePack.id) return false

  // For installed packages, check conflicts from store
  if (isInstalled.value) {
    // Try exact match first
    let conflicts = conflictStore.getConflictsForPackage(nodePack.id)
    if (conflicts) return true

    return false
  }

  // For uninstalled packages, check compatibility directly
  if (
    nodePack.supported_os ||
    nodePack.supported_accelerators ||
    nodePack.supported_comfyui_version
  ) {
    const compatibility = checkVersionCompatibility({
      supported_os: nodePack.supported_os,
      supported_accelerators: nodePack.supported_accelerators,
      supported_comfyui_version: nodePack.supported_comfyui_version,
      supported_comfyui_frontend_version:
        nodePack.supported_comfyui_frontend_version
    })
    return compatibility.hasConflict
  }

  return false
})
</script>
