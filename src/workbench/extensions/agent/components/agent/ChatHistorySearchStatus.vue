<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { query, count } = defineProps<{
  query: string
  count?: number
}>()
const { t } = useI18n()
</script>

<template>
  <div role="status">
    <p
      v-if="count === 0"
      class="px-2 py-8 text-center text-sm text-muted-foreground"
    >
      {{ t('agent.historyNoResults', { query }) }}
    </p>
    <span v-else-if="count !== undefined" class="sr-only">{{
      t('agent.historySearchCount', { count }, count)
    }}</span>
  </div>
</template>
