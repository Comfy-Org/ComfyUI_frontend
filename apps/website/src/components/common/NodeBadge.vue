<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const { segments, segmentClass = 'px-6' } = defineProps<{
  segments: Array<{ text?: string; logoSrc?: string; logoAlt?: string }>
  segmentClass?: string
}>()
</script>

<template>
  <div
    class="font-formula-condensed flex h-11 items-stretch font-semibold **:select-none sm:h-auto"
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
        :class="
          cn(
            'bg-primary-comfy-yellow text-primary-comfy-ink flex items-center justify-center py-1.5 transition-all duration-300 sm:py-3 lg:py-5',
            segmentClass
          )
        "
      >
        <img
          v-if="segment.logoSrc"
          :src="segment.logoSrc"
          :alt="segment.logoAlt ?? ''"
          class="inline-block h-5 brightness-0 transition-all duration-300 sm:h-7 lg:h-10"
        />
        <span
          v-else
          class="inline-block translate-y-1 text-2xl font-bold whitespace-nowrap transition-all duration-300 sm:text-3xl lg:text-5xl"
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
