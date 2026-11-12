<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import EndingFrame from '@/components/fullPage/EndingFrame.vue'
import { handoffTab } from '@/handoff/handoffTab'

const { t } = useI18n()

const ending = computed(() =>
  handoffTab.value?.kind === 'ended' ? handoffTab.value.ending : 'session_ended'
)
</script>

<template>
  <EndingFrame
    :title="t(`handoff.${ending}.title`)"
    :body="t(`handoff.${ending}.body`)"
  >
    <p class="m-0 text-center text-sm text-muted-foreground">
      {{ t('checkout.fullPage.ending.closeTab') }}
    </p>
  </EndingFrame>
</template>
