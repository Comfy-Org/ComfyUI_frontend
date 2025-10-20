<template>
  <NoResultsPlaceholder
    class="pb-0"
    icon="pi pi-exclamation-circle"
    :title="$t('loadWorkflowWarning.missingNodesTitle')"
    :message="$t('loadWorkflowWarning.missingNodesDescription')"
  />
  <MissingCoreNodesMessage :missing-core-nodes="missingCoreNodes" />
  <ListBox
    :options="uniqueNodes"
    option-label="label"
    scroll-height="100%"
    class="comfy-missing-nodes"
    :pt="{
      list: { class: 'border-none' }
    }"
  >
    <template #option="slotProps">
      <div class="align-items-center flex">
        <span class="node-type">{{ slotProps.option.label }}</span>
        <span v-if="slotProps.option.hint" class="node-hint">{{
          slotProps.option.hint
        }}</span>
        <Button
          v-if="slotProps.option.action"
          :label="slotProps.option.action.text"
          size="small"
          outlined
          @click="slotProps.option.action.callback"
        />
      </div>
    </template>
  </ListBox>
  <div v-if="showManagerButtons" class="flex justify-end py-3">
    <PackInstallButton
      v-if="showInstallAllButton"
      size="md"
      :disabled="
        isLoading || !!error || missingNodePacks.length === 0 || isInstalling
      "
      :is-loading="isLoading"
      :node-packs="missingNodePacks"
      :label="
        isLoading
          ? $t('manager.gettingInfo')
          : $t('manager.installAllMissingNodes')
      "
    />
    <Button
      :label="$t('g.openManager')"
      size="small"
      outlined
      @click="openManager"
    />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ListBox from 'primevue/listbox'
import { computed, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import MissingCoreNodesMessage from '@/components/dialog/content/MissingCoreNodesMessage.vue'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useDialogStore } from '@/stores/dialogStore'
import type { MissingNodeType } from '@/types/comfy'
import PackInstallButton from '@/workbench/extensions/manager/components/manager/button/PackInstallButton.vue'
import { useMissingNodes } from '@/workbench/extensions/manager/composables/nodePack/useMissingNodes'
import { useManagerState } from '@/workbench/extensions/manager/composables/useManagerState'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'

const props = defineProps<{
  missingNodeTypes: MissingNodeType[]
}>()

// Get missing node packs from workflow with loading and error states
const { missingNodePacks, isLoading, error, missingCoreNodes } =
  useMissingNodes()

const comfyManagerStore = useComfyManagerStore()
const managerState = useManagerState()

// Check if any of the missing packs are currently being installed
const isInstalling = computed(() => {
  if (!missingNodePacks.value?.length) return false
  return missingNodePacks.value.some((pack) =>
    comfyManagerStore.isPackInstalling(pack.id)
  )
})

const uniqueNodes = computed(() => {
  const seenTypes = new Set()
  return props.missingNodeTypes
    .filter((node) => {
      const type = typeof node === 'object' ? node.type : node
      if (seenTypes.has(type)) return false
      seenTypes.add(type)
      return true
    })
    .map((node) => {
      if (typeof node === 'object') {
        return {
          label: node.type,
          hint: node.hint,
          action: node.action
        }
      }
      return { label: node }
    })
})

// Show manager buttons unless manager is disabled
const showManagerButtons = computed(() => {
  return managerState.shouldShowManagerButtons.value
})

// Only show Install All button for NEW_UI (new manager with v4 support)
const showInstallAllButton = computed(() => {
  return managerState.shouldShowInstallButton.value
})

const openManager = async () => {
  await managerState.openManager({
    initialTab: ManagerTab.Missing,
    showToastOnLegacyError: true
  })
}

const { t } = useI18n()
const dialogStore = useDialogStore()

// Computed to check if all missing nodes have been installed
const allMissingNodesInstalled = computed(() => {
  return (
    !isLoading.value &&
    !isInstalling.value &&
    missingNodePacks.value?.length === 0
  )
})
// Watch for completion and close dialog
watch(allMissingNodesInstalled, async (allInstalled) => {
  if (allInstalled && showInstallAllButton.value) {
    // Use nextTick to ensure state updates are complete
    await nextTick()

    dialogStore.closeDialog({ key: 'global-load-workflow-warning' })

    // Show success toast
    useToastStore().add({
      severity: 'success',
      summary: t('g.success'),
      detail: t('manager.allMissingNodesInstalled'),
      life: 3000
    })
  }
})
</script>

<style scoped>
.comfy-missing-nodes {
  max-height: 300px;
  overflow-y: auto;
}

.node-hint {
  margin-left: 0.5rem;
  font-style: italic;
  color: var(--text-color-secondary);
}

:deep(.p-button) {
  margin-left: auto;
}
</style>
