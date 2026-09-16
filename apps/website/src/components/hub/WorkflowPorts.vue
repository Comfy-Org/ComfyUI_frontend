<script setup lang="ts">
const { heading, rows } = defineProps<{
  heading: string
  rows: readonly { name: string; type: string }[]
}>()
</script>

<template>
  <div>
    <h2
      class="text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
    >
      {{ heading }}
    </h2>
    <dl class="mt-3 flex flex-col divide-y divide-transparency-white-t8">
      <div
        v-for="row in rows"
        :key="row.name"
        class="flex items-center justify-between gap-3 py-2 text-sm"
      >
        <dt class="text-primary-comfy-canvas">{{ row.name }}</dt>
        <dd class="font-mono text-xs text-primary-warm-gray">{{ row.type }}</dd>
      </div>
    </dl>
  </div>
</template>
