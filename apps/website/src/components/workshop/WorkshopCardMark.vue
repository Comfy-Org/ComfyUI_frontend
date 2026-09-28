<script setup lang="ts">
// Who answers for the card: the provider of a model, the model a workflow runs
// on. It rides over the artwork rather than in the title, where it would spend
// the line and truncate, and it opens to the name on hover so a shelf reads as
// marks until the reader asks.
const { label, logo } = defineProps<{
  label: string
  logo: string | null
}>()
</script>

<template>
  <span
    class="pointer-events-none absolute right-4 bottom-4 z-10 inline-flex h-7 max-w-[calc(100%-2rem)] min-w-7 items-center justify-center rounded-lg bg-black/45 px-1.5 text-2xs/4 font-semibold text-white backdrop-blur-md"
    data-testid="model-card-provider"
  >
    <span
      v-if="logo"
      class="size-3.5 shrink-0 bg-white mask-contain mask-center mask-no-repeat"
      :style="{ maskImage: `url(${logo})` }"
      aria-hidden="true"
    />
    <span v-else class="shrink-0 text-xs" aria-hidden="true">
      {{ label.charAt(0).toUpperCase() }}
    </span>
    <span
      class="grid grid-cols-[0fr] transition-[grid-template-columns] duration-300 ease-out group-focus-within:grid-cols-[1fr] group-hover:grid-cols-[1fr]"
    >
      <span class="overflow-hidden">
        <span class="block truncate pl-1.5 whitespace-nowrap">
          {{ label }}
        </span>
      </span>
    </span>
  </span>
</template>
