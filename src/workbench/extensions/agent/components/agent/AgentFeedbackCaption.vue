<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { openFeedbackDialog } from '../../feedback'

const { t } = useI18n()
</script>

<template>
  <button
    type="button"
    class="-mt-1.5 mb-0 min-h-6 w-full cursor-pointer bg-transparent py-1 text-center text-xs text-muted-foreground hover:text-base-foreground focus-visible:ring-2 focus-visible:ring-primary-background focus-visible:outline-none"
    @click="openFeedbackDialog('agent-panel')"
  >
    {{ t('agent.feedbackCaption') }}
  </button>
</template>
