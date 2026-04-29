<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import TypeformPopoverButton from '@/components/ui/TypeformPopoverButton.vue'

const WIDGET_ID = 'jmmzmlKw'

const { t } = useI18n()
</script>

<template>
  <div
    class="feedback-cell flex size-full items-center gap-2 px-1 [&_a_i,&_button_i]:size-5"
  >
    <TypeformPopoverButton :data-tf-widget="WIDGET_ID" />
    <div
      class="flex flex-col overflow-hidden text-layout-md leading-[1.1] whitespace-nowrap text-layout-mute"
    >
      <span>{{ t('linearMode.beta') }}</span>
      <span>{{ t('linearMode.giveFeedback') }}</span>
    </div>
  </div>
</template>

<style scoped>
/* `!important` to override design-system utilities baked into
   TypeformPopoverButton's variant="inverted". */
.feedback-cell :deep(:is(a, button)) {
  background-color: transparent !important;
  color: var(--color-layout-mute) !important;
}
.feedback-cell :deep(:is(a, button):hover) {
  background-color: var(--color-layout-cell-hover) !important;
  color: var(--color-layout-text) !important;
}
</style>
