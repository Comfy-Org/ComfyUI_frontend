<template>
  <div class="flex items-center gap-1">
    <Popover :show-arrow="false" :class="cn(menuContentClass, 'min-w-56')">
      <template #button>
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
      </template>
      <template #default="{ close }">
        <div class="flex flex-col">
          <button
            type="button"
            data-testid="docked-job-history-action"
            :class="cn(menuButtonClass, 'justify-between')"
            @click="onToggleDockedJobHistory(close)"
          >
            <span class="flex items-center gap-2">
              <i
                class="icon-[lucide--panel-left-close] size-4 text-text-secondary"
              />
              <span>{{
                t('sideToolbar.queueProgressOverlay.dockedJobHistory')
              }}</span>
            </span>
            <i
              v-if="isQueuePanelV2Enabled"
              class="icon-[lucide--check] size-4"
            />
          </button>
          <button
            type="button"
            data-testid="show-run-progress-bar-action"
            :class="cn(menuButtonClass, 'justify-between')"
            @click="onToggleRunProgressBar"
          >
            <span class="flex items-center gap-2">
              <i class="icon-[lucide--hourglass] size-4 text-text-secondary" />
              <span>{{
                t('sideToolbar.queueProgressOverlay.showRunProgressBar')
              }}</span>
            </span>
            <i
              v-if="isRunProgressBarEnabled"
              class="icon-[lucide--check] size-4"
            />
          </button>
          <!-- TODO: Bug in assets sidebar panel derives assets from history, so despite this not deleting the assets, it still effectively shows to the user as deleted -->
          <template v-if="showClearHistoryAction">
            <div class="my-1 border-t border-interface-stroke" />
            <button
              type="button"
              data-testid="clear-history-action"
              :class="
                cn(menuButtonClass, 'h-auto items-start whitespace-normal')
              "
              @click="onClearHistoryFromMenu(close)"
            >
              <i
                class="icon-[lucide--trash-2] size-4 shrink-0 self-center text-destructive-background"
              />
              <span
                class="flex flex-col items-start text-left leading-tight wrap-break-word"
              >
                <span class="text-sm font-light">
                  {{ t('sideToolbar.queueProgressOverlay.clearHistory') }}
                </span>
                <span class="text-xs font-light text-text-secondary">
                  {{
                    t(
                      'sideToolbar.queueProgressOverlay.clearHistoryMenuAssetsNote'
                    )
                  }}
                </span>
              </span>
            </button>
          </template>
        </div>
      </template>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import {
  menuButtonClass,
  menuContentClass
} from '@/components/ui/menu/menuStyles'
import { useQueueFeatureFlags } from '@/composables/queue/useQueueFeatureFlags'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useSurveyFeatureTracking } from '@/platform/surveys/useSurveyFeatureTracking'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { cn } from '@comfyorg/tailwind-utils'

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
const showClearHistoryAction = computed(() => !isCloud)

const onClearHistoryFromMenu = (close: () => void) => {
  close()
  emit('clearHistory')
}

const onToggleDockedJobHistory = async (close: () => void) => {
  trackFeatureUsed()
  close()

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
