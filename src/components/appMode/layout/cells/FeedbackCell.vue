<script setup lang="ts">
/**
 * FeedbackCell — bottom-left system-pinned cell that opens the
 * "App Mode in beta / Give feedback" Typeform.
 *
 * Reuses the existing TypeformPopoverButton (question-mark icon,
 * opens an embedded Typeform in a popover on desktop, external link
 * on mobile) paired with the same two lines of text from the old
 * LinearFeedback component.
 *
 * Arbitrary variants on the wrapper mute TypeformPopoverButton's
 * `variant="inverted"` (which renders a loud white button — too bright
 * inside a dark layout cell) so the chrome blends in, and match the
 * 20px icon size used by sibling IconCells.
 */
import { useI18n } from 'vue-i18n'

import TypeformPopoverButton from '@/components/ui/TypeformPopoverButton.vue'

// Widget ID matches the one previously passed from LinearView to
// LinearPreview/LinearFeedback. Hardcoded here since the cell is the
// feedback surface; a single source of truth can be extracted later
// if other cells need a Typeform.
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
/* Mute TypeformPopoverButton's `variant="inverted"` (loud white) so
   it blends into the dark chrome. `!important` matches the pattern
   in PanelBlockList — needed to win against the design-system
   utilities baked into the primitive. */
.feedback-cell :deep(:is(a, button)) {
  background-color: transparent !important;
  color: var(--color-layout-mute) !important;
}
.feedback-cell :deep(:is(a, button):hover) {
  background-color: var(--color-layout-cell-hover) !important;
  color: var(--color-layout-text) !important;
}
</style>
