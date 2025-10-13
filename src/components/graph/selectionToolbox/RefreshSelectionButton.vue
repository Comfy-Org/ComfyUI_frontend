<template>
  <Button
    v-show="isRefreshable"
    v-tooltip.top="t('g.refreshNode')"
    severity="secondary"
    text
    data-testid="refresh-button"
    @click="refreshSelected"
  >
    <i class="icon-[lucide--refresh-cw] h-4 w-4" />
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'

import { useRefreshableSelection } from '@/composables/useRefreshableSelection'

const { t } = useI18n()
const { isRefreshable, refreshSelected } = useRefreshableSelection()
</script>
