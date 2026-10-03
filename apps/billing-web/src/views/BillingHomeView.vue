<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import HostedSurface from '@/components/HostedSurface.vue'

const { t } = useI18n()
</script>

<template>
  <HostedSurface>
    <p class="m-0 text-sm text-muted-foreground">
      {{ t('hosted.landing.body') }}
    </p>
  </HostedSurface>
</template>
