<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { openFeedbackDialog } from '../../feedback'

const { t } = useI18n()
</script>

<template>
  <button
    type="button"
    class="text-agent-fg-muted hover:text-agent-fg focus-visible:ring-agent-accent -mt-1.5 mb-0 min-h-6 w-full cursor-pointer bg-transparent py-1 text-center text-xs focus-visible:ring-2 focus-visible:outline-none"
    @click="openFeedbackDialog('agent-panel')"
  >
    {{ t('agent.feedbackCaption') }}
  </button>
</template>
