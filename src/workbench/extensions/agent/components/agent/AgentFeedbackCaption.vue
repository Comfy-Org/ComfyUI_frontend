<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { openFeedbackDialog } from '../../feedback'

const { t } = useI18n()
</script>

<template>
  <Button
    type="button"
    variant="muted-textonly"
    size="sm"
    class="-mt-1.5 mb-0 w-full"
    @click="openFeedbackDialog('agent-panel')"
  >
    {{ t('agent.feedbackCaption') }}
  </Button>
</template>
