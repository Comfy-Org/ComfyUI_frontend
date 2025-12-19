<template>
  <Button
    v-show="isRefreshable"
    v-tooltip.top="t('g.refreshNode')"
    variant="textonly"
    size="icon"
    data-testid="refresh-button"
    @click="refreshSelected"
  >
    <i class="icon-[lucide--refresh-cw] size-4" />
  </Button>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useRefreshableSelection } from '@/composables/useRefreshableSelection'

const { t } = useI18n()
const { isRefreshable, refreshSelected } = useRefreshableSelection()
</script>
