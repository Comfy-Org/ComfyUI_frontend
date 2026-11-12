<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useSubgraphInputValues } from './useSubgraphInputValues'
import { useSubgraphInputValuesStore } from './subgraphInputValuesStore'
import SubgraphInputValue from './SubgraphInputValue.vue'

const { t } = useI18n()
const context = useSubgraphInputValuesStore()
const { rows, resolve, locate } = useSubgraphInputValues()
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-(--node-widget-gap)">
    <template v-if="context.selected">
      <SubgraphInputValue
        v-for="row in rows"
        :key="`${context.selected.graphId}:${context.selected.id}:${row.name}`"
        :label="row.label"
        :host="context.selected"
        :resolve="() => resolve(row.name)"
        @locate="locate"
      />
      <p v-if="!rows.length" class="mx-3 my-0 text-muted-foreground">
        {{ t('subgraphInputValues.noInputs') }}
      </p>
    </template>
    <p v-else class="mx-3 my-0 text-muted-foreground">
      {{ t('subgraphInputValues.enterInstanceHint') }}
    </p>
  </div>
</template>
