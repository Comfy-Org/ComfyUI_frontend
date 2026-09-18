<script setup lang="ts">
defineProps<{ active: 'models' | 'workflows' }>()
</script>

<template>
  <nav
    aria-label="Explore Comfy"
    class="mb-8 flex gap-7 border-b border-transparency-white-t8 text-sm font-medium"
  >
    <a
      v-for="item in ['models', 'workflows'] as const"
      :key="item"
      :href="item === 'models' ? '/models/' : '/models/workflows/'"
      :aria-current="active === item ? 'page' : undefined"
      class="border-b-2 px-1 py-4 capitalize transition-colors hover:text-primary-comfy-yellow focus-visible:outline-2 focus-visible:outline-primary-comfy-yellow"
      :class="
        active === item
          ? 'border-primary-comfy-yellow text-primary-comfy-yellow'
          : 'border-transparent text-primary-warm-gray'
      "
    >
      {{ item }}
    </a>
  </nav>
</template>
