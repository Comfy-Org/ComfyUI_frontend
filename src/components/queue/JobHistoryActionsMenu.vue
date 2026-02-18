<template>
  <div class="flex items-center gap-1">
    <Button
      v-tooltip.top="moreTooltipConfig"
      variant="textonly"
      size="icon"
      :aria-label="t('sideToolbar.queueProgressOverlay.moreOptions')"
      @click="onMoreClick"
    >
      <i
        class="icon-[lucide--more-horizontal] block size-4 leading-none text-text-secondary"
      />
    </Button>
    <Popover
      ref="morePopoverRef"
      :dismissable="true"
      :close-on-escape="true"
      unstyled
      :pt="{
        root: { class: 'absolute z-50' },
        content: {
          class: [
            'bg-transparent border-none p-0 pt-2 rounded-lg shadow-lg font-inter'
          ]
        }
      }"
    >
      <div
        class="flex flex-col items-stretch rounded-lg border border-interface-stroke bg-interface-panel-surface px-2 py-3 font-inter"
      >
        <Button
          class="w-full justify-start"
          variant="textonly"
          size="sm"
          :aria-label="t('sideToolbar.queueProgressOverlay.clearHistory')"
          @click="onClearHistoryFromMenu"
        >
          <i class="icon-[lucide--file-x-2] size-4 text-muted" />
          <span>{{ t('sideToolbar.queueProgressOverlay.clearHistory') }}</span>
        </Button>
      </div>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import Popover from 'primevue/popover'
import type { PopoverMethods } from 'primevue/popover'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'

const emit = defineEmits<{
  (e: 'clearHistory'): void
}>()

const { t } = useI18n()

const morePopoverRef = ref<PopoverMethods | null>(null)
const moreTooltipConfig = computed(() => buildTooltipConfig(t('g.more')))

const onMoreClick = (event: MouseEvent) => {
  morePopoverRef.value?.toggle(event)
}

const onClearHistoryFromMenu = () => {
  morePopoverRef.value?.hide()
  emit('clearHistory')
}
</script>
