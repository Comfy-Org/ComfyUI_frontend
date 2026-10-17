<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import EndingFrame from '@/components/fullPage/EndingFrame.vue'

const { t } = useI18n()
</script>

<template>
  <EndingFrame
    :title="t('desktopTopupReturn.title')"
    :body="t('desktopTopupReturn.body')"
  >
    <p class="m-0 text-center text-sm text-muted-foreground">
      {{ t('checkout.fullPage.ending.closeTab') }}
    </p>
  </EndingFrame>
</template>
