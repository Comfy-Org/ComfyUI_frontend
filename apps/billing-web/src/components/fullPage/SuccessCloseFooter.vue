<script setup lang="ts">
import { useCountdown } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

const CLOSE_AFTER_SECONDS = 5

/** Browsers let only a tab a script opened close itself, so only that tab counts down. */
const { closesItself } = defineProps<{ closesItself: boolean }>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()

const { remaining } = useCountdown(CLOSE_AFTER_SECONDS, {
  immediate: closesItself,
  onComplete: () => emit('close')
})
</script>

<template>
  <p class="m-0 text-center text-sm text-muted-foreground">
    {{
      closesItself
        ? t('checkout.fullPage.ending.closingIn', { seconds: remaining })
        : t('checkout.fullPage.ending.closeTab')
    }}
  </p>
</template>
