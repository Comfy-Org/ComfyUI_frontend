<script setup lang="ts">
const { segments, segmentClass = 'px-6' } = defineProps<{
  segments: Array<{ text?: string; logoSrc?: string; logoAlt?: string }>
  segmentClass?: string
}>()
</script>

<template>
  <div
    class="font-formula-condensed flex h-9 items-stretch font-semibold **:select-none lg:h-auto"
  >
    <img
      src="/icons/node-left.svg"
      alt=""
      class="-mx-px self-stretch"
      aria-hidden="true"
    />

    <template
      v-for="(segment, i) in segments"
      :key="segment.text || segment.logoSrc || i"
    >
      <img
        v-if="i > 0"
        src="/icons/node-union.svg"
        alt=""
        class="-mx-px self-stretch"
        aria-hidden="true"
      />
      <span
        class="bg-primary-comfy-yellow text-primary-comfy-ink flex items-center justify-center py-1 lg:py-5"
        :class="segmentClass"
      >
        <img
          v-if="segment.logoSrc"
          :src="segment.logoSrc"
          :alt="segment.logoAlt ?? ''"
          class="inline-block h-4 brightness-0 lg:h-10"
        />
        <span
          v-else
          class="inline-block translate-y-0.5 text-xl font-bold whitespace-nowrap lg:translate-y-1 lg:text-5xl"
        >
          {{ segment.text }}
        </span>
      </span>
    </template>

    <img
      src="/icons/node-right.svg"
      alt=""
      class="-mx-px self-stretch"
      aria-hidden="true"
    />
  </div>
</template>
