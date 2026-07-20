<script setup lang="ts">
// Play-button overlay for thumbnail links. The parent provides the positioning
// context (`relative`) and, via class fallthrough, any hover-reveal classes.
const { size = 'lg' } = defineProps<{ size?: 'sm' | 'lg' }>()
</script>

<template>
  <span
    class="absolute inset-0 flex items-center justify-center"
    aria-hidden="true"
  >
    <span
      class="flex items-center justify-center rounded-full bg-white/25 backdrop-blur-sm"
      :class="
        size === 'sm'
          ? 'size-9'
          : 'size-14 transition-transform group-hover:scale-105'
      "
    >
      <svg
        :class="size === 'sm' ? 'ml-0.5 size-4' : 'ml-1 size-5'"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 5v14l11-7z" />
      </svg>
    </span>
  </span>
</template>
