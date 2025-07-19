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
          :has-conflict="!!packageConflicts"
        />
      </template>
      <template v-else>
        <PackEnableToggle
          :node-pack="nodePack"
          :has-conflict="!!packageConflicts"
        />
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
import type { ConflictDetectionResult } from '@/types/conflictDetectionTypes'

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

// Function to check compatibility for uninstalled packages using centralized logic
function checkUninstalledPackageCompatibility(
  pack: components['schemas']['Node']
): ConflictDetectionResult | null {
  const compatibility = checkVersionCompatibility({
    supported_os: pack.supported_os,
    supported_accelerators: pack.supported_accelerators,
    supported_comfyui_version: pack.supported_comfyui_version,
    supported_comfyui_frontend_version: pack.supported_comfyui_frontend_version
  })

  if (compatibility.hasConflict) {
    return {
      package_id: pack.id || 'unknown',
      package_name: pack.name || 'unknown',
      has_conflict: true,
      conflicts: compatibility.conflicts,
      is_compatible: false
    }
  }

  return null
}

const packageConflicts = computed(() => {
  if (!nodePack.id) return null

  // For installed packages, check conflicts from store
  if (isInstalled.value) {
    let conflicts = conflictStore.getConflictsForPackage(nodePack.id)

    // Try exact match by package_id
    if (!conflicts && nodePack.id) {
      conflicts =
        conflictStore.conflictedPackages.find(
          (p) => p.package_id.toLowerCase() === nodePack.id?.toLowerCase()
        ) || undefined
    }

    // Try exact match by package_name
    if (!conflicts && nodePack.name) {
      conflicts =
        conflictStore.conflictedPackages.find(
          (p) => p.package_name === nodePack.name
        ) || undefined
    }

    // Try partial matching - check if nodePack.id is contained in conflict package_id
    if (!conflicts && nodePack.id) {
      conflicts =
        conflictStore.conflictedPackages.find(
          (p) =>
            p.package_id
              .toLowerCase()
              .includes(nodePack.id?.toLowerCase() || '') ||
            nodePack.id?.toLowerCase().includes(p.package_id.toLowerCase())
        ) || undefined
    }

    // Try partial matching with name
    if (!conflicts && nodePack.name) {
      conflicts =
        conflictStore.conflictedPackages.find(
          (p) =>
            p.package_name
              .toLowerCase()
              .includes(nodePack.name?.toLowerCase() || '') ||
            nodePack.name?.toLowerCase().includes(p.package_name.toLowerCase())
        ) || undefined
    }

    return conflicts
  }

  // For not installed packages (All tab), check compatibility directly
  // from the node pack's latest version info
  if (
    nodePack.supported_os ||
    nodePack.supported_accelerators ||
    nodePack.supported_comfyui_version
  ) {
    // This will be checked in real-time
    return checkUninstalledPackageCompatibility(nodePack)
  }

  return null
})
</script>
