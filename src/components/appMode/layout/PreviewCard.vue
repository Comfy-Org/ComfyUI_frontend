<script setup lang="ts">
import { useId } from 'vue'

// Inert preview card used in the Builder's Preview step.
defineProps<{ title: string }>()

// Wire the title span as the accessible name of the section landmark
// so assistive tech announces it during landmark navigation.
const titleId = useId()
</script>

<template>
  <section
    class="panel-chrome flex flex-col overflow-hidden"
    :aria-labelledby="titleId"
  >
    <header
      class="flex min-h-layout-cell items-center gap-2 border-b border-(--border-color) bg-(--color-layout-header-fill) px-[10px] py-2 select-none"
    >
      <span
        :id="titleId"
        class="truncate text-layout-md font-semibold text-layout-text"
      >
        {{ title }}
      </span>
    </header>
    <div class="flex-1 overflow-hidden">
      <slot />
    </div>
  </section>
</template>
