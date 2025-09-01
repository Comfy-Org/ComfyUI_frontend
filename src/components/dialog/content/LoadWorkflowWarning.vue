<template>
  <NoResultsPlaceholder
    class="pb-0"
    icon="pi pi-exclamation-circle"
    title="Some Nodes Are Missing"
    message="When loading the graph, the following node types were not found"
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
      <div class="flex align-items-center">
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
  <div
    v-if="managerState && managerState !== ManagerUIState.DISABLED"
    class="flex justify-end py-3"
  >
    <PackInstallButton
      v-if="managerState === ManagerUIState.NEW_UI"
      :disabled="isLoading || !!error || missingNodePacks.length === 0"
      :node-packs="missingNodePacks"
      variant="black"
      :label="$t('manager.installAllMissingNodes')"
    />
    <Button
      label="Open Manager"
      size="small"
      outlined
      @click="handleOpenManager"
    />
  </div>
</template>

<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import Button from 'primevue/button'
import ListBox from 'primevue/listbox'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import MissingCoreNodesMessage from '@/components/dialog/content/MissingCoreNodesMessage.vue'
import PackInstallButton from '@/components/dialog/content/manager/button/PackInstallButton.vue'
import { useMissingNodes } from '@/composables/nodePack/useMissingNodes'
import { useDialogService } from '@/services/dialogService'
import { useCommandStore } from '@/stores/commandStore'
import {
  ManagerUIState,
  useManagerStateStore
} from '@/stores/managerStateStore'
import { useToastStore } from '@/stores/toastStore'
import type { MissingNodeType } from '@/types/comfy'
import { ManagerTab } from '@/types/comfyManagerTypes'

const props = defineProps<{
  missingNodeTypes: MissingNodeType[]
}>()

// Get missing node packs from workflow with loading and error states
const { missingNodePacks, isLoading, error, missingCoreNodes } =
  useMissingNodes()

// Get manager state asynchronously
const managerStateStore = useManagerStateStore()
const { state: managerState } = useAsyncState(
  () => managerStateStore.getManagerUIState(),
  null
)

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

const handleOpenManager = async () => {
  if (managerState.value === ManagerUIState.NEW_UI) {
    useDialogService().showManagerDialog({
      initialTab: ManagerTab.Missing
    })
  } else if (managerState.value === ManagerUIState.LEGACY_UI) {
    try {
      await useCommandStore().execute('Comfy.Manager.Menu.ToggleVisibility')
    } catch {
      // If legacy command doesn't exist, show toast
      const { t } = useI18n()
      useToastStore().add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('manager.legacyMenuNotAvailable'),
        life: 3000
      })
    }
  }
}
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
