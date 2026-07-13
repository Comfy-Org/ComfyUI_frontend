<script setup lang="ts">
const { title, description } = defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <section
    class="rounded-2xl border border-border-subtle bg-base-background p-5"
  >
    <h2 class="m-0 text-base font-semibold">{{ title }}</h2>
    <p v-if="description" class="mt-1 mb-0 text-sm text-muted-foreground">
      {{ description }}
    </p>
    <div class="mt-4">
      <slot />
    </div>
  </section>
</template>
