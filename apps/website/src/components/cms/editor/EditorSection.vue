<script setup lang="ts">
const { title, description } = defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <section class="rounded-lg border border-admin-line bg-admin-card">
    <header
      class="flex flex-wrap items-start justify-between gap-3 border-b border-admin-line px-5 py-4"
    >
      <div class="grid max-w-xl min-w-0 gap-1">
        <h2 class="text-sm font-medium text-admin-fg">{{ title }}</h2>
        <p v-if="description" class="text-xs text-admin-muted">
          {{ description }}
        </p>
      </div>
      <slot name="actions" />
    </header>
    <div class="grid gap-4 px-5 py-4">
      <slot />
    </div>
  </section>
</template>
