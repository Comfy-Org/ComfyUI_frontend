<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

import { openFeedbackDialog } from '../../feedback'

const { t } = useI18n()
</script>

<template>
  <Button
    type="button"
    variant="link"
    size="sm"
    class="text-agent-fg-muted hover:text-agent-fg focus-visible:ring-agent-accent -mt-1.5 mb-0 w-full rounded-none px-0 font-normal focus-visible:ring-2"
    @click="openFeedbackDialog('agent-panel')"
  >
    {{ t('agent.feedbackCaption') }}
  </Button>
</template>
