<script setup lang="ts">
import IconModel from './IconModel.vue'

// Who answers for the card: the provider of a model, the model a workflow runs
// on. It rides over the artwork rather than in the title, where it would spend
// the line and truncate, and it opens to the name on hover so the shelf reads
// as marks until the reader asks.
const { label, logo } = defineProps<{
  label: string
  logo: string | undefined
}>()
</script>

<template>
  <span
    class="pointer-events-none absolute right-4 bottom-4 z-20 inline-flex h-7 max-w-[calc(100%-2rem)] min-w-7 items-center justify-center rounded-lg bg-black/45 px-1.5 text-2xs/4 font-semibold tracking-wide text-white backdrop-blur-md"
    :title="label"
    data-testid="hub-card-mark"
  >
    <span
      v-if="logo"
      class="size-3.5 shrink-0 bg-white mask-contain mask-center mask-no-repeat"
      :style="{ maskImage: `url(${logo})` }"
      aria-hidden="true"
    />
    <IconModel v-else class="size-3.5 shrink-0" aria-hidden="true" />
    <!-- The name opens to its own width rather than to a guessed one. -->
    <span
      class="grid grid-cols-closed items-center overflow-hidden group-focus-within:grid-cols-open group-hover:grid-cols-open motion-safe:transition-[grid-template-columns] motion-safe:duration-200 motion-safe:ease-out"
    >
      <span
        class="flex min-w-0 items-center truncate ps-1.5 leading-none whitespace-nowrap"
        >{{ label }}</span
      >
    </span>
  </span>
</template>
