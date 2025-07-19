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
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { useConflictDetectionStore } from '@/stores/conflictDetectionStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import type { components } from '@/types/comfyRegistryTypes'
import type {
  ConflictDetail,
  ConflictDetectionResult
} from '@/types/conflictDetectionTypes'

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
const systemStatsStore = useSystemStatsStore()

// Use cached system stats from store (no additional API calls needed)

// Function to check compatibility for uninstalled packages
function checkUninstalledPackageCompatibility(
  pack: components['schemas']['Node']
): ConflictDetectionResult | null {
  const systemStats = systemStatsStore.systemStats
  if (!systemStats) return null

  const conflicts: ConflictDetail[] = []

  // Check OS compatibility
  if (pack.supported_os && pack.supported_os.length > 0) {
    const currentOS = systemStats.system?.os || 'unknown'
    const supportedOSList = pack.supported_os.map((os) => os.toLowerCase())

    if (
      !supportedOSList.some((supportedOS) => {
        return (
          currentOS.toLowerCase().includes(supportedOS) ||
          supportedOS.includes(currentOS.toLowerCase())
        )
      })
    ) {
      conflicts.push({
        type: 'os',
        current_value: currentOS,
        required_value: pack.supported_os.join(', ')
      })
    }
  }

  // Check accelerator compatibility
  if (pack.supported_accelerators && pack.supported_accelerators.length > 0) {
    // Extract available accelerators from system stats devices
    const availableAccelerators: string[] = []
    if (systemStats.devices) {
      for (const device of systemStats.devices) {
        if (device.type === 'cuda') availableAccelerators.push('CUDA')
        if (device.type === 'mps') availableAccelerators.push('Metal')
      }
    }
    // CPU is always available
    availableAccelerators.push('CPU')

    const hasCompatibleAccelerator = pack.supported_accelerators.some(
      (reqAccel) =>
        availableAccelerators.some(
          (avail) => avail.toLowerCase() === reqAccel.toLowerCase()
        )
    )

    if (!hasCompatibleAccelerator) {
      conflicts.push({
        type: 'accelerator',
        current_value: availableAccelerators.join(', '),
        required_value: pack.supported_accelerators.join(', ')
      })
    }
  }

  // Check ComfyUI version compatibility
  if (pack.supported_comfyui_version) {
    // For now, just return null if version checking is needed
    // This would need proper version comparison logic
  }

  if (conflicts.length > 0) {
    return {
      package_id: pack.id || 'unknown',
      package_name: pack.name || 'unknown',
      has_conflict: true,
      conflicts,
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
