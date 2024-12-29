<template>
  <div
    class="font-sans w-screen h-screen flex items-center justify-center pointer-events-auto"
    :class="[
      props.dark
        ? 'text-neutral-300 bg-neutral-900 dark-theme'
        : 'text-neutral-900 bg-neutral-300'
    ]"
  >
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    dark: boolean
  }>(),
  {
    dark: false
  }
)
</script>
