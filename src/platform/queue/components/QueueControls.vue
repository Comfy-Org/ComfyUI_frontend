<template>
  <Button
    :tooltip="t('menu.interrupt')"
    tooltip-side="bottom"
    :variant="canInterrupt ? 'destructive' : 'secondary'"
    size="icon"
    :disabled="!canInterrupt"
    :aria-label="t('menu.interrupt')"
    @click="cancelCurrentJob"
  >
    <i class="icon-[lucide--x]" />
  </Button>
  <ContextMenu :model="queueContextMenuItems">
    <Button
      :tooltip="queueToggleLabel"
      tooltip-side="bottom"
      variant="secondary"
      size="md"
      :aria-pressed="
        isQueuePanelV2Enabled
          ? activeSidebarTabId === 'job-history'
          : queueOverlayExpanded
      "
      class="px-3"
      data-testid="queue-overlay-toggle"
      @click="toggleQueueOverlay"
      @contextmenu.stop
    >
      <span class="text-sm font-normal tabular-nums">
        {{ activeJobsLabel }}
      </span>
      <Badge
        v-if="activeJobsCount > 0"
        data-testid="active-jobs-indicator"
        variant="dot"
        severity="default"
        class="pointer-events-none absolute -top-0.5 -right-0.5 animate-pulse"
      />
      <span class="sr-only">{{ queueToggleLabel }}</span>
    </Button>
  </ContextMenu>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Badge from '@comfyorg/design-system/badge/Badge'
import Button from '@comfyorg/design-system/button/Button'
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import ContextMenu from '@comfyorg/design-system/menu/ContextMenu'

import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useInterruptibleJob } from '@/platform/queue/composables/useInterruptibleJob'
import { useQueueFeatureFlags } from '@/platform/queue/composables/useQueueFeatureFlags'
import { useQueueStore } from '@/platform/queue/stores/queueStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const { queueOverlayExpanded = false } = defineProps<{
  queueOverlayExpanded?: boolean
}>()

const { t, n } = useI18n()
const commandStore = useCommandStore()
const queueStore = useQueueStore()
const sidebarTabStore = useSidebarTabStore()
const { interruptibleJobId, canInterrupt } = useInterruptibleJob()
const { activeJobsCount } = storeToRefs(queueStore)
const { activeSidebarTabId } = storeToRefs(sidebarTabStore)
const { isQueuePanelV2Enabled } = useQueueFeatureFlags()

const queueToggleLabel = computed(() =>
  t(
    isQueuePanelV2Enabled.value
      ? 'sideToolbar.queueProgressOverlay.viewJobHistory'
      : 'sideToolbar.queueProgressOverlay.expandCollapsedQueue'
  )
)
const activeJobsLabel = computed(() => {
  const count = activeJobsCount.value
  return t(
    'sideToolbar.queueProgressOverlay.activeJobsShort',
    { count: n(count) },
    count
  )
})
const queueContextMenuItems = computed<MenuItem[]>(() => [
  {
    label: t('sideToolbar.queueProgressOverlay.clearQueueTooltip'),
    icon: 'icon-[lucide--list-x] text-destructive',
    class: '*:text-destructive',
    disabled: queueStore.pendingTasks.length === 0,
    command: () => {
      void commandStore.execute('Comfy.ClearPendingTasks')
    }
  }
])

const cancelCurrentJob = async () => {
  const jobId = interruptibleJobId.value
  if (!jobId) return
  await commandStore.execute('Comfy.Interrupt', { metadata: { jobId } })
}
const toggleQueueOverlay = () => {
  if (isQueuePanelV2Enabled.value) {
    sidebarTabStore.toggleSidebarTab('job-history')
    return
  }
  commandStore.execute('Comfy.Queue.ToggleOverlay')
}
</script>
