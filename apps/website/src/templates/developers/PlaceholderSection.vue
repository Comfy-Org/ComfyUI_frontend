<script setup lang="ts">
/* Walking-skeleton scaffolding for the /developers build-out: marks where a
   planned section lands until its ticket replaces it with the real block.
   Intentionally not localized — removed before the page is linked anywhere. */
defineProps<{ name: string; block: string }>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-8 lg:px-20">
    <div
      class="border-page-fg/25 flex min-h-56 flex-col items-center justify-center gap-2 rounded-4xl border border-dashed text-center"
    >
      <p class="text-2xl font-light">{{ name }}</p>
      <p class="text-page-fg/50 text-sm">{{ block }}</p>
    </div>
  </section>
</template>
