<script setup lang="ts">
import { TabsList, TabsTrigger } from 'reka-ui'

defineProps<{
  clients: Record<string, { name: string }>
  label: string
}>()
</script>

<template>
  <TabsList
    :aria-label="label"
    class="grid grid-cols-1 gap-px rounded-2xl border border-white/15 bg-primary-comfy-ink p-1 min-[360px]:grid-cols-2 lg:inline-flex lg:max-w-full lg:flex-wrap"
  >
    <TabsTrigger
      v-for="(client, id) in clients"
      :key="id"
      :value="id"
      class="shrink-0 cursor-pointer rounded-lg bg-white/8 px-2 py-2.5 text-[10px] font-bold tracking-wider whitespace-nowrap text-smoke-700 uppercase transition-colors hover:text-primary-comfy-canvas focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none data-[state=active]:bg-primary-comfy-yellow data-[state=active]:text-primary-comfy-ink lg:rounded-none lg:px-6 lg:text-xs lg:first:rounded-l-xl lg:last:rounded-r-xl"
      >{{ client.name }}</TabsTrigger
    >
  </TabsList>
</template>
