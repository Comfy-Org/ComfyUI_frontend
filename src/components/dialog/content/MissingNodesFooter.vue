<template>
  <!-- Cloud mode: Learn More + Got It buttons -->
  <div
    v-if="isCloud"
    class="flex w-full items-center justify-between gap-2 px-4 py-2"
  >
    <Button
      variant="textonly"
      size="sm"
      as="a"
      href="https://www.comfy.org/cloud"
      target="_blank"
      rel="noopener noreferrer"
    >
      <i class="icon-[lucide--info]" />
      <span>{{ $t('missingNodes.cloud.learnMore') }}</span>
    </Button>
    <Button
      variant="secondary"
      size="md"
      @click="handleGotItClick"
    >
      {{
        $t('missingNodes.cloud.gotIt')
      }}
    </Button>
  </div>

  <!-- OSS mode: Open Manager + Install All buttons -->
  <div
    v-else-if="showManagerButtons"
    class="flex justify-end gap-1 px-4 py-2"
  >
    <Button
      variant="textonly"
      @click="openManager"
    >
      {{
        $t('g.openManager')
      }}
    </Button>
    <PackInstallButton
      v-if="showInstallAllButton"
      type="secondary"
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
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { isCloud } from '@/platform/distribution/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useDialogStore } from '@/stores/dialogStore'
import PackInstallButton from '@/workbench/extensions/manager/components/manager/button/PackInstallButton.vue'
import { useMissingNodes } from '@/workbench/extensions/manager/composables/nodePack/useMissingNodes'
import { useManagerState } from '@/workbench/extensions/manager/composables/useManagerState'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'

const dialogStore = useDialogStore()
const { t } = useI18n()

const handleGotItClick = () => {
  dialogStore.closeDialog({ key: 'global-missing-nodes' })
}

const { missingNodePacks, isLoading, error } = useMissingNodes()
const comfyManagerStore = useComfyManagerStore()
const managerState = useManagerState()

// Check if any of the missing packs are currently being installed
const isInstalling = computed(() => {
  if (!missingNodePacks.value?.length) return false
  return missingNodePacks.value.some((pack) =>
    comfyManagerStore.isPackInstalling(pack.id)
  )
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

// Computed to check if all missing nodes have been installed
const allMissingNodesInstalled = computed(() => {
  return (
    !isLoading.value &&
    !isInstalling.value &&
    missingNodePacks.value?.length === 0
  )
})

// Watch for completion and close dialog (OSS mode only)
watch(allMissingNodesInstalled, async (allInstalled) => {
  if (!isCloud && allInstalled && showInstallAllButton.value) {
    // Use nextTick to ensure state updates are complete
    await nextTick()

    dialogStore.closeDialog({ key: 'global-missing-nodes' })

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
