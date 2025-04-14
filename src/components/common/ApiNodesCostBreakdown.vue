<template>
  <div class="flex flex-col gap-3 h-full">
    <div class="flex justify-between text-xs">
      <div>{{ t('apiNodesCostBreakdown.title') }}</div>
      <div>{{ t('apiNodesCostBreakdown.costPerRun') }}</div>
    </div>
    <ScrollPanel class="flex-grow h-0">
      <div class="flex flex-col gap-2">
        <div
          v-for="node in nodes"
          :key="node.name"
          class="flex items-center justify-between px-3 py-2 rounded-md bg-[var(--p-content-border-color)]"
        >
          <div class="flex items-center gap-2">
            <span class="text-base font-medium leading-tight">{{
              node.name
            }}</span>
          </div>
          <div class="flex items-center gap-1">
            <Tag
              severity="secondary"
              icon="pi pi-dollar"
              rounded
              class="text-amber-400 p-1"
            />
            <span class="text-base font-medium leading-tight">
              {{ node.cost.toFixed(costPrecision) }}
            </span>
          </div>
        </div>
      </div>
    </ScrollPanel>
    <template v-if="showTotal && nodes.length > 1">
      <Divider class="my-2" />
      <div class="flex justify-between items-center border-t px-3">
        <span class="text-sm">{{ t('apiNodesCostBreakdown.totalCost') }}</span>
        <div class="flex items-center gap-1">
          <Tag
            severity="secondary"
            icon="pi pi-dollar"
            rounded
            class="text-yellow-500 p-1"
          />
          <span>{{ totalCost.toFixed(costPrecision) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import Divider from 'primevue/divider'
import ScrollPanel from 'primevue/scrollpanel'
import Tag from 'primevue/tag'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ApiNodeCost } from '@/types/apiNodeTypes'

const { t } = useI18n()

const {
  nodes,
  showTotal = true,
  costPrecision = 3
} = defineProps<{
  nodes: ApiNodeCost[]
  showTotal?: boolean
  costPrecision?: number
}>()

const totalCost = computed(() =>
  nodes.reduce((sum, node) => sum + node.cost, 0)
)
</script>
