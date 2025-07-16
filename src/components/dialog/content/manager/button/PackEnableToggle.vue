<template>
  <div class="flex items-center gap-2">
    <div
      v-if="hasConflict"
      v-tooltip="{
        value: $t('manager.conflicts.warningTooltip'),
        showDelay: 300
      }"
      class="flex items-center justify-center w-6 h-6 cursor-pointer"
      @click="showConflictModal"
    >
      <i class="pi pi-exclamation-triangle text-yellow-500 text-xl"></i>
    </div>
    <ToggleSwitch
      :model-value="isEnabled"
      :disabled="isLoading"
      aria-label="Enable or disable pack"
      @update:model-value="handleToggleClick"
    />
  </div>
</template>

<script setup lang="ts">
import { debounce } from 'lodash'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref } from 'vue'

import { useConflictAcknowledgment } from '@/composables/useConflictAcknowledgment'
import { useDialogService } from '@/services/dialogService'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { useConflictDetectionStore } from '@/stores/conflictDetectionStore'
import type { components } from '@/types/comfyRegistryTypes'
import { components as ManagerComponents } from '@/types/generatedManagerTypes'

const TOGGLE_DEBOUNCE_MS = 256

const { nodePack, hasConflict } = defineProps<{
  nodePack: components['schemas']['Node']
  hasConflict?: boolean
}>()

const { isPackEnabled, enablePack, disablePack } = useComfyManagerStore()
const conflictStore = useConflictDetectionStore()
const { showNodeConflictDialog } = useDialogService()
const { acknowledgeConflict, isConflictAcknowledged } =
  useConflictAcknowledgment()

const isLoading = ref(false)

const isEnabled = computed(() => isPackEnabled(nodePack.id))

const handleEnable = () => {
  if (!nodePack.id) {
    throw new Error('Node ID is required for enabling')
  }
  return enablePack.call({
    id: nodePack.id,
    version:
      nodePack.latest_version?.version ??
      ('latest' as ManagerComponents['schemas']['SelectedVersion']),
    selected_version:
      nodePack.latest_version?.version ??
      ('latest' as ManagerComponents['schemas']['SelectedVersion']),
    repository: nodePack.repository ?? '',
    channel: 'default' as ManagerComponents['schemas']['ManagerChannel'],
    mode: 'cache' as ManagerComponents['schemas']['ManagerDatabaseSource'],
    skip_post_install: false
  })
}

const handleDisable = () => {
  if (!nodePack.id) {
    throw new Error('Node ID is required for disabling')
  }
  return disablePack({
    id: nodePack.id,
    version:
      nodePack.latest_version?.version ??
      ('latest' as ManagerComponents['schemas']['SelectedVersion'])
  })
}

const handleToggle = async (enable: boolean, skipConflictCheck = false) => {
  if (isLoading.value) return

  // Check for conflicts when enabling
  if (enable && hasConflict && !skipConflictCheck) {
    const conflicts = conflictStore.getConflictsForPackage(nodePack.id || '')
    if (conflicts) {
      // Check if conflicts have been acknowledged
      const hasUnacknowledgedConflicts = conflicts.conflicts.some(
        (conflict) => !isConflictAcknowledged(nodePack.id || '', conflict.type)
      )

      if (hasUnacknowledgedConflicts) {
        console.log(
          'PackEnableToggle - calling showNodeConflictDialog with buttonText: Enable Anyway'
        )
        showNodeConflictDialog({
          conflictedPackages: [conflicts],
          buttonText: 'Enable Anyway',
          onButtonClick: async () => {
            // User chose "Enable Anyway" - acknowledge all conflicts and proceed
            for (const conflict of conflicts.conflicts) {
              acknowledgeConflict(nodePack.id || '', conflict.type, '0.1.0')
            }
            // Proceed with enabling using debounced function
            onToggle(enable)
          }
        })
        return
      }
    }
  }

  // No conflicts or conflicts acknowledged - proceed with toggle
  await performToggle(enable)
}

const performToggle = async (enable: boolean) => {
  isLoading.value = true
  if (enable) {
    await handleEnable()
  } else {
    await handleDisable()
  }
  isLoading.value = false
}

// Handle initial toggle click - check for conflicts first
const handleToggleClick = (enable: boolean) => {
  void handleToggle(enable)
}

const onToggle = debounce(
  (enable: boolean) => {
    void handleToggle(enable, true) // Skip conflict check when called from onDismiss
  },
  TOGGLE_DEBOUNCE_MS,
  { trailing: true }
)

// Show conflict modal when warning icon is clicked
const showConflictModal = () => {
  if (isEnabled.value) {
    return
  }

  const conflicts = conflictStore.getConflictsForPackage(nodePack.id || '')
  if (conflicts) {
    showNodeConflictDialog({
      conflictedPackages: [conflicts],
      buttonText: 'Enable Anyway',
      onButtonClick: async () => {
        // User chose "Enable Anyway" - acknowledge all conflicts and proceed
        for (const conflict of conflicts.conflicts) {
          acknowledgeConflict(nodePack.id || '', conflict.type, '0.1.0')
        }
        // Proceed with enabling using debounced function
        onToggle(true)
      }
    })
  }
}
</script>
