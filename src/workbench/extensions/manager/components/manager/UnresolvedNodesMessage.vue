<template>
  <div class="flex flex-col items-center gap-3 p-8">
    <i class="icon-[lucide--triangle-alert] text-4xl text-warning-background" />
    <h3 class="text-base font-semibold">
      {{ $t('manager.unresolvedNodes.title') }}
    </h3>
    <p class="text-center text-sm text-muted-foreground">
      {{ $t('manager.unresolvedNodes.message') }}
    </p>
    <ul class="mt-2 flex flex-col gap-1 rounded-lg bg-secondary-background p-2">
      <li
        v-for="name in nodeNames"
        :key="name"
        class="px-3 py-1.5 font-mono text-sm"
      >
        {{ name }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  nodeNames: string[]
}>()
</script>
