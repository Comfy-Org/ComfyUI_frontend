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
  <div v-if="!isLegacyManager" class="flex justify-end py-3">
    <PackInstallButton
      :disabled="
        isLoading || !!error || missingNodePacks.length === 0 || isInstalling
      "
      :node-packs="missingNodePacks"
      :label="
        isLoading
          ? $t('manager.gettingInfo')
          : $t('manager.installAllMissingNodes')
      "
    />
    <Button label="Open Manager" size="small" outlined @click="openManager" />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ListBox from 'primevue/listbox'
import { computed, onMounted, ref } from 'vue'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import MissingCoreNodesMessage from '@/components/dialog/content/MissingCoreNodesMessage.vue'
import { useMissingNodes } from '@/composables/nodePack/useMissingNodes'
import { useComfyManagerService } from '@/services/comfyManagerService'
import { useDialogService } from '@/services/dialogService'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import type { MissingNodeType } from '@/types/comfy'
import { ManagerTab } from '@/types/comfyManagerTypes'

import PackInstallButton from './manager/button/PackInstallButton.vue'

const props = defineProps<{
  missingNodeTypes: MissingNodeType[]
}>()

// Get missing node packs from workflow with loading and error states
const { missingNodePacks, isLoading, error, missingCoreNodes } =
  useMissingNodes()

const comfyManagerStore = useComfyManagerStore()
const isLegacyManager = ref(false)

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

const openManager = () => {
  useDialogService().showManagerDialog({
    initialTab: ManagerTab.Missing
  })
}

onMounted(async () => {
  const isLegacyResponse = await useComfyManagerService().isLegacyManagerUI()
  if (isLegacyResponse?.is_legacy_manager_ui) {
    isLegacyManager.value = true
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
