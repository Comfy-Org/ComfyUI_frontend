<script setup lang="ts">
defineProps<{
  heading: string
  subtitle?: string
  columns?: 2 | 3
}>()
</script>

<template>
  <section class="px-4 py-24 lg:px-20">
    <div class="mx-auto max-w-3xl text-center">
      <h2
        class="text-primary-comfy-canvas text-3xl font-light lg:text-5xl/tight"
      >
        {{ heading }}
      </h2>
      <p v-if="subtitle" class="mt-4 text-sm text-smoke-700 lg:text-base">
        {{ subtitle }}
      </p>
    </div>

    <div
      class="mt-12 grid gap-6 lg:mt-16"
      :class="columns === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'"
    >
      <slot />
    </div>

    <slot name="footer" />
  </section>
</template>
