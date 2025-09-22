<script setup lang="ts">
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'

import { useRefreshableSelection } from '@/composables/useRefreshableSelection'

const { t } = useI18n()
const { isRefreshable, refreshSelected } = useRefreshableSelection()
</script>

<template>
  <Button
    v-show="isRefreshable"
    v-tooltip.top="t('g.refreshNode')"
    severity="secondary"
    text
    data-testid="refresh-button"
    @click="refreshSelected"
  >
    <i-lucide:refresh-cw class="w-4 h-4" />
  </Button>
</template>
