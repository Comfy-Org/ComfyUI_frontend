<script setup lang="ts">
/**
 * FeedbackCell — bottom-left system-pinned cell that opens the
 * "App Mode in beta / Give feedback" Typeform.
 *
 * Reuses the existing TypeformPopoverButton (question-mark icon,
 * opens an embedded Typeform in a popover on desktop, external link
 * on mobile) paired with the same two lines of text from the old
 * LinearFeedback component.
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
  <div class="feedback-cell">
    <TypeformPopoverButton :data-tf-widget="WIDGET_ID" align="start" />
    <div class="feedback-cell__text">
      <span>{{ t('linearMode.beta') }}</span>
      <span>{{ t('linearMode.giveFeedback') }}</span>
    </div>
  </div>
</template>

<style scoped>
.feedback-cell {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  gap: 8px;
  padding: 0 4px;
}

.feedback-cell__text {
  display: flex;
  flex-direction: column;
  font-size: var(--bento-font-md);
  line-height: 1.3;
  color: var(--bento-color-text-muted);
  white-space: nowrap;
  overflow: hidden;
}

/* TypeformPopoverButton uses variant="inverted" which renders a
   white button — too loud inside a dark bento cell. Mute it to
   match the cell text color and let the cell bg show through. */
.feedback-cell :deep(button),
.feedback-cell :deep(a) {
  background-color: transparent !important;
  color: var(--bento-color-text-muted) !important;
}

.feedback-cell :deep(button:hover),
.feedback-cell :deep(a:hover) {
  background-color: var(--bento-color-cell-hover) !important;
  color: var(--bento-color-text) !important;
}
</style>
