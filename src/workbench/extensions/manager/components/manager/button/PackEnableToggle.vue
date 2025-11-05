<template>
  <div class="flex items-center gap-2">
    <div
      v-if="hasConflict"
      v-tooltip="{
        value: $t('manager.conflicts.warningTooltip'),
        showDelay: 300
      }"
      class="flex h-6 w-6 cursor-pointer items-center justify-center"
      @click="showConflictModal(true)"
    >
      <i class="pi pi-exclamation-triangle text-xl text-yellow-500"></i>
    </div>
    <ToggleSwitch
      v-if="!canToggleDirectly"
      :model-value="isEnabled"
      :disabled="isLoading"
      :readonly="!canToggleDirectly"
      :aria-label="$t('g.enableOrDisablePack')"
      @focus="handleToggleInteraction"
    />
    <ToggleSwitch
      v-else
      :model-value="isEnabled"
      :disabled="isLoading"
      :aria-label="$t('g.enableOrDisablePack')"
      @update:model-value="onToggle"
    />
  </div>
</template>
<script setup lang="ts">
import { debounce } from 'es-toolkit/compat'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useDialogService } from '@/services/dialogService'
import type { components } from '@/types/comfyRegistryTypes'
import { useConflictAcknowledgment } from '@/workbench/extensions/manager/composables/useConflictAcknowledgment'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import { useConflictDetectionStore } from '@/workbench/extensions/manager/stores/conflictDetectionStore'
import type { components as ManagerComponents } from '@/workbench/extensions/manager/types/generatedManagerTypes'

const TOGGLE_DEBOUNCE_MS = 256

const { nodePack, hasConflict } = defineProps<{
  nodePack: components['schemas']['Node']
  hasConflict?: boolean
}>()

const { t } = useI18n()
const { isPackEnabled, enablePack, disablePack, installedPacks } =
  useComfyManagerStore()
const { getConflictsForPackageByID } = useConflictDetectionStore()
const { showNodeConflictDialog } = useDialogService()
const { acknowledgmentState, markConflictsAsSeen } = useConflictAcknowledgment()

const isLoading = ref(false)

const isEnabled = computed(() => isPackEnabled(nodePack.id))
const version = computed(() => {
  const id = nodePack.id
  if (!id) return 'nightly' as ManagerComponents['schemas']['SelectedVersion']
  return (
    installedPacks[id]?.ver ??
    nodePack.latest_version?.version ??
    ('nightly' as ManagerComponents['schemas']['SelectedVersion'])
  )
})

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

const showConflictModal = (skipModalDismissed: boolean) => {
  let modal_dismissed = acknowledgmentState.value.modal_dismissed
  if (skipModalDismissed) modal_dismissed = false
  if (packageConflict.value && !modal_dismissed) {
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
  return enablePack({
    id: nodePack.id,
    version:
      version.value ??
      ('latest' as ManagerComponents['schemas']['SelectedVersion'])
  })
}

const handleDisable = () => {
  if (!nodePack.id) {
    throw new Error('Node ID is required for disabling')
  }
  return disablePack({
    id: nodePack.id,
    version:
      version.value ??
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
    showConflictModal(false)
  }
}
</script>
