<script setup lang="ts">
const { title, description } = defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <header class="flex flex-wrap items-start justify-between gap-4">
    <div class="max-w-2xl min-w-0">
      <slot name="eyebrow" />
      <h1 class="text-admin-title leading-tight font-normal text-admin-fg">
        {{ title }}
      </h1>
      <p v-if="description?.trim()" class="mt-1 text-sm text-admin-muted">
        {{ description }}
      </p>
      <slot />
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
