<template>
  <dl
    class="my-1 flex flex-col divide-y divide-border rounded-lg border bg-secondary/40"
  >
    <div
      v-for="row in rows"
      :key="row.label"
      class="flex items-baseline gap-3 px-3.5 py-2 text-sm/5"
    >
      <dt class="shrink-0 text-muted-foreground @xl:w-38">
        {{ row.label }}
      </dt>
      <dd class="m-0 flex min-w-0 flex-1 items-baseline gap-3 text-foreground">
        <span class="min-w-0 flex-1 truncate" :title="row.name">
          {{ row.name }}
        </span>
        <span v-if="row.more" class="shrink-0 text-muted-foreground">
          {{ row.more }}
        </span>
      </dd>
    </div>
  </dl>
</template>

<script setup lang="ts">
import type { MissingItemsRow } from '@/platform/workspace/customDeploymentPitch'

const { rows } = defineProps<{
  rows: readonly MissingItemsRow[]
}>()
</script>
