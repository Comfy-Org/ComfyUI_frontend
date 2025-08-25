<template>
  <Button
    v-tooltip.top="t('g.refreshNode')"
    v-show="isRefreshable"
    severity="secondary"
    text
    @click="refreshSelected"
  >
    <i-lucide:refresh-cw :size="16" />
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'

import { useRefreshableSelection } from '@/composables/useRefreshableSelection'

const { t } = useI18n()
const { isRefreshable, refreshSelected } = useRefreshableSelection()
</script>
