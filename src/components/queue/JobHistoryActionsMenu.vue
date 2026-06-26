<template>
  <DropdownMenu :modal="false">
    <DropdownMenuTrigger as-child>
      <Button
        v-tooltip.top="moreTooltipConfig"
        variant="textonly"
        size="icon"
        :aria-label="t('sideToolbar.queueProgressOverlay.moreOptions')"
      >
        <i
          class="icon-[lucide--more-horizontal] block size-4 leading-none text-text-secondary"
        />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent size="lg" align="end" :side-offset="4">
      <DropdownMenuItem
        data-testid="docked-job-history-action"
        @select="onToggleDockedJobHistory"
      >
        <template #icon>
          <i class="icon-[lucide--panel-left-close]" />
        </template>
        {{ t('sideToolbar.queueProgressOverlay.dockedJobHistory') }}
        <i
          v-if="isQueuePanelV2Enabled"
          class="ml-auto icon-[lucide--check] size-3.5"
        />
      </DropdownMenuItem>
      <DropdownMenuItem
        data-testid="show-run-progress-bar-action"
        @select="onToggleRunProgressBar"
      >
        <template #icon>
          <i class="icon-[lucide--hourglass]" />
        </template>
        {{ t('sideToolbar.queueProgressOverlay.showRunProgressBar') }}
        <i
          v-if="isRunProgressBarEnabled"
          class="ml-auto icon-[lucide--check] size-3.5"
        />
      </DropdownMenuItem>
      <template v-if="showClearHistoryAction">
        <DropdownMenuSeparator />
        <DropdownMenuItem
          v-tooltip.left="clearHistoryTooltipConfig"
          data-testid="clear-history-action"
          :class="menuItemDestructiveClasses"
          @select="emit('clearHistory')"
        >
          <template #icon>
            <i class="icon-[lucide--trash-2]" />
          </template>
          {{ t('sideToolbar.queueProgressOverlay.clearHistory') }}
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'
import DropdownMenuSeparator from '@/components/ui/dropdown-menu/DropdownMenuSeparator.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu/DropdownMenuTrigger.vue'
import { menuItemDestructiveClasses } from '@/components/ui/menu.styles'
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
const clearHistoryTooltipConfig = computed(() =>
  buildTooltipConfig(
    t('sideToolbar.queueProgressOverlay.clearHistoryMenuAssetsNote')
  )
)
const { isQueuePanelV2Enabled, isRunProgressBarEnabled } =
  useQueueFeatureFlags()
const showClearHistoryAction = computed(() => !isCloud)

const onToggleDockedJobHistory = async () => {
  trackFeatureUsed()
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

const onToggleRunProgressBar = async () => {
  trackFeatureUsed()
  await settingStore.set(
    'Comfy.Queue.ShowRunProgressBar',
    !isRunProgressBarEnabled.value
  )
}
</script>
