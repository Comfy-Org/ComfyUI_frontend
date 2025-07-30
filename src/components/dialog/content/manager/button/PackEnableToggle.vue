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
      v-if="!canToggleDirectly"
      :model-value="isEnabled"
      :disabled="isLoading"
      :readonly="!canToggleDirectly"
      aria-label="Enable or disable pack"
      @focus="handleToggleInteraction"
    />
    <ToggleSwitch
      v-else
      :model-value="isEnabled"
      :disabled="isLoading"
      aria-label="Enable or disable pack"
      @update:model-value="onToggle"
    />
  </div>
</template>

<script setup lang="ts">
import { debounce } from 'lodash'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

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

const { t } = useI18n()
const { isPackEnabled, enablePack, disablePack } = useComfyManagerStore()
const { getConflictsForPackageByID } = useConflictDetectionStore()
const { showNodeConflictDialog } = useDialogService()
const { acknowledgmentState, markConflictsAsSeen } = useConflictAcknowledgment()

const isLoading = ref(false)

const isEnabled = computed(() => isPackEnabled(nodePack.id))
const packageConflict = computed(() =>
  getConflictsForPackageByID(nodePack.id || '')
)

const canToggleDirectly = computed(() => {
  return !(
    hasConflict &&
    !acknowledgmentState.value.modal_dismissed &&
    packageConflict.value
  )
})

const showConflictModal = () => {
  if (packageConflict.value && !acknowledgmentState.value.modal_dismissed) {
    showNodeConflictDialog({
      conflictedPackages: [packageConflict.value],
      buttonText: !isEnabled.value
        ? t('manager.conflicts.enableAnyway')
        : t('manager.conflicts.understood'),
      onButtonClick: async () => {
        if (!isEnabled.value) {
          await handleEnable()
        }
      },
      dialogComponentProps: {
        onClose: () => {
          markConflictsAsSeen()
        }
      }
    })
  }
}

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

const handleToggle = async (enable: boolean) => {
  if (isLoading.value) return

  isLoading.value = true
  if (enable) {
    await handleEnable()
  } else {
    await handleDisable()
  }
  isLoading.value = false
}

const onToggle = debounce(
  (enable: boolean) => {
    void handleToggle(enable)
  },
  TOGGLE_DEBOUNCE_MS,
  { trailing: true }
)

const handleToggleInteraction = async (event: Event) => {
  if (!canToggleDirectly.value) {
    event.preventDefault()
    showConflictModal()
  }
}
</script>
