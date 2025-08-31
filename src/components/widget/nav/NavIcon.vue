<template>
  <span class="text-xs text-neutral">
    <i-lucide:box v-if="name === 'box'" />
    <i-lucide:command v-else-if="name === 'command'" />
    <i-lucide:dumbbell v-else-if="name === 'dumbbell'" />
    <i-lucide:film v-else-if="name === 'film'" />
    <i-lucide:folder v-else-if="name === 'folder'" />
    <i-lucide:graduation-cap v-else-if="name === 'graduation-cap'" />
    <i-lucide:hand-coins v-else-if="name === 'hand-coins'" />
    <i-lucide:image v-else-if="name === 'image'" />
    <i-lucide:layout-grid v-else-if="name === 'layout-grid'" />
    <i-lucide:list v-else-if="name === 'list'" />
    <i-lucide:maximize-2 v-else-if="name === 'maximize-2'" />
    <i-lucide:message-square-text v-else-if="name === 'message-square-text'" />
    <i-lucide:puzzle v-else-if="name === 'puzzle'" />
    <i-lucide:sliders-horizontal v-else-if="name === 'sliders-horizontal'" />
    <i-lucide:volume-2 v-else-if="name === 'volume-2'" />
    <i-lucide:wrench v-else-if="name === 'wrench'" />
    <i-lucide:zap v-else-if="name === 'zap'" />
    <i-lucide:download v-else-if="name === 'download'" />
    <i-lucide:tag v-else-if="name === 'tag'" />
    <i-lucide:layers v-else-if="name === 'layers'" />
    <i-lucide:grid-3-x-3 v-else-if="name === 'grid-3-x-3'" />
  </span>
</template>

<script setup lang="ts">
defineProps<{
  name?: string
}>()
</script>
