<template>
  <dl
    class="my-1 flex flex-col divide-y divide-border rounded-lg border bg-secondary/40"
  >
    <div
      v-for="row in rows"
      :key="row.label"
      class="flex flex-col gap-x-3 px-3.5 py-2 text-sm/5 @xl:flex-row @xl:items-baseline"
    >
      <dt class="shrink-0 text-muted-foreground @xl:w-38">
        {{ row.label }}
      </dt>
      <dd class="m-0 flex min-w-0 flex-1 items-baseline gap-3 text-foreground">
        <span
          v-if="isExpanded(row)"
          class="min-w-0 flex-1 wrap-break-word"
          data-testid="missing-items-names"
        >
          {{ row.name }}, {{ row.others }}
        </span>
        <span
          v-else-if="row.more"
          class="min-w-0 flex-1 truncate"
          :title="row.name"
        >
          {{ row.name }}
        </span>
        <span v-else class="min-w-0 flex-1 wrap-break-word">
          {{ row.name }}
        </span>
        <button
          v-if="row.more"
          type="button"
          class="shrink-0 cursor-pointer rounded-sm border-none bg-transparent p-0 text-sm/5 text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground focus-visible:outline-none"
          :aria-expanded="isExpanded(row)"
          :title="isExpanded(row) ? undefined : row.others"
          @click="toggle(row)"
        >
          {{
            isExpanded(row)
              ? $t('deploymentSwitcher.workflowNeedsDeployment.showLess')
              : row.more
          }}
        </button>
      </dd>
    </div>
  </dl>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import type { MissingItemsRow } from '@/platform/workspace/customDeploymentPitch'

const { rows } = defineProps<{
  rows: readonly MissingItemsRow[]
}>()

const expandedLabels = ref<readonly string[]>([])

function isExpanded(row: MissingItemsRow) {
  return expandedLabels.value.includes(row.label)
}

function toggle(row: MissingItemsRow) {
  expandedLabels.value = isExpanded(row)
    ? expandedLabels.value.filter((label) => label !== row.label)
    : [...expandedLabels.value, row.label]
}
</script>
