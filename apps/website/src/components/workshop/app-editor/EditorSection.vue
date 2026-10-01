<script setup lang="ts">
const { title } = defineProps<{ title: string }>()
</script>

<template>
  <section
    :aria-label="title"
    class="flex flex-col gap-3 border-b border-transparency-white-t8 px-4 py-4"
  >
    <div class="flex min-h-6 items-center justify-between gap-2 px-1">
      <h2
        class="text-[11px] font-medium tracking-wider text-primary-warm-gray uppercase"
      >
        {{ title }}
      </h2>
      <slot name="actions" />
    </div>
    <slot />
  </section>
</template>
