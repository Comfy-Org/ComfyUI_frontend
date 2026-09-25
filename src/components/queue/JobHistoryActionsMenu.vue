<template>
  <Menu v-model:open="open" :items="items" align="end">
    <template #trigger>
      <Tooltip :config="moreTooltipConfig" side="top">
        <Button
          variant="muted-textonly"
          size="icon"
          :aria-label="t('sideToolbar.queueProgressOverlay.moreOptions')"
          icon="icon-[lucide--more-horizontal]"
        />
      </Tooltip>
    </template>
  </Menu>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import { useQueueFeatureFlags } from '@/composables/queue/useQueueFeatureFlags'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useSurveyFeatureTracking } from '@/platform/surveys/useSurveyFeatureTracking'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const emit = defineEmits<{
  (e: 'clearHistory'): void
}>()

const { t } = useI18n()
const settingStore = useSettingStore()
const sidebarTabStore = useSidebarTabStore()
const { trackFeatureUsed } = useSurveyFeatureTracking('queue-progress-overlay')

const moreTooltipConfig = computed(() => buildTooltipConfig(t('g.more')))
const { isQueuePanelV2Enabled, isRunProgressBarEnabled } =
  useQueueFeatureFlags()
const open = ref(false)
const items = computed<MenuItem[]>(() => [
  {
    label: t('sideToolbar.queueProgressOverlay.dockedJobHistory'),
    icon: 'icon-[lucide--panel-left-close]',
    checked: isQueuePanelV2Enabled.value,
    command: onToggleDockedJobHistory
  },
  {
    label: t('sideToolbar.queueProgressOverlay.showRunProgressBar'),
    icon: 'icon-[lucide--hourglass]',
    checked: isRunProgressBarEnabled.value,
    command: onToggleRunProgressBar
  },
  { separator: true, visible: !isCloud },
  {
    label: t('sideToolbar.queueProgressOverlay.clearHistory'),
    description: t(
      'sideToolbar.queueProgressOverlay.clearHistoryMenuAssetsNote'
    ),
    icon: 'icon-[lucide--trash-2]',
    variant: 'destructive',
    visible: !isCloud,
    command: () => emit('clearHistory')
  }
])

async function onToggleDockedJobHistory() {
  trackFeatureUsed()
  open.value = false

  try {
    if (isQueuePanelV2Enabled.value) {
      await settingStore.setMany({
        'Comfy.Queue.QPOV2': false,
        'Comfy.Queue.History.Expanded': true
      })
      return
    }

    sidebarTabStore.activeSidebarTabId = 'job-history'
    await settingStore.set('Comfy.Queue.QPOV2', true)
  } catch {
    return
  }
}

async function onToggleRunProgressBar() {
  trackFeatureUsed()
  await settingStore.set(
    'Comfy.Queue.ShowRunProgressBar',
    !isRunProgressBarEnabled.value
  )
}
</script>
