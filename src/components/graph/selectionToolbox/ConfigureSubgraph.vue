<template>
  <Button
    v-tooltip.top="{
      value: t('Edit Subgraph Widgets'),
      showDelay: 1000
    }"
    severity="secondary"
    text
    @click="showSubgraphNodeDialog"
  >
    <template #icon>
      <i-lucide:settings2 />
    </template>
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'

import { showSubgraphNodeDialog } from '@/core/graph/subgraph/useSubgraphNodeDialog'

const { t } = useI18n()
</script>
