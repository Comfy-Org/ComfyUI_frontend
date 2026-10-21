<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { ToasterProps } from '@/components/ui/toast/Toaster.vue'
import Toaster from '@/components/ui/toast/Toaster.vue'

const { closeLabel, regionLabel, formatViewportLabel } =
  defineProps<Partial<ToasterProps>>()

const { t } = useI18n()
</script>

<template>
  <Toaster
    :close-label="closeLabel ?? t('g.close')"
    :region-label="regionLabel ?? t('toastMessages.notificationsLabel')"
    :format-viewport-label="
      formatViewportLabel ??
      ((hotkey) => t('toastMessages.notificationsViewportLabel', { hotkey }))
    "
  />
</template>
