<template>
  <dl
    class="my-1 flex flex-col divide-y divide-border rounded-lg border bg-secondary/40"
  >
    <div
      v-for="row in rows"
      :key="row.label"
      class="flex flex-col gap-x-3 px-3.5 py-2 text-sm/5 @xl:flex-row"
    >
      <dt class="shrink-0 text-muted-foreground @xl:w-38">
        {{ row.label }}
      </dt>
      <dd class="m-0 min-w-0 wrap-break-word text-foreground">
        {{ row.names }}
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
