<script setup lang="ts">
const { src, alt, label } = defineProps<{
  src: string
  alt: string
  label?: string
}>()
</script>

<template>
  <div
    class="relative size-full overflow-hidden rounded-[1.25em] border border-white/12 bg-black/40"
  >
    <Transition
      enter-active-class="transition-opacity duration-500 ease-out"
      leave-active-class="transition-opacity duration-500 ease-out absolute inset-0"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
      mode="default"
    >
      <img
        :key="src"
        :src
        :alt
        class="absolute inset-0 size-full object-cover"
        decoding="async"
      />
    </Transition>

    <span
      v-if="label"
      class="bg-secondary-deep-plum absolute top-[1em] left-[1em] z-10 flex items-center gap-[0.5em] rounded-[0.5em] px-[0.9em] py-[0.45em]"
    >
      <span class="bg-primary-comfy-yellow size-[0.5em] rounded-full" />
      <span
        class="text-primary-comfy-yellow font-formula text-[0.75em] font-semibold tracking-[0.12em]"
      >
        {{ label }}
      </span>
    </span>
  </div>
</template>
