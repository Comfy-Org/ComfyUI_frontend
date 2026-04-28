<script setup lang="ts">
/**
 * Inert preview-only card used in the App Builder's Preview/Arrange
 * step. Mirrors the visual surface of `AppPanel` / `OutputWindow`
 * (`panel-chrome` + a header strip) so what authors see in Preview
 * reads as the runtime UI, but with no drag / collapse / menu —
 * it's a layout placeholder, not an interactive surface.
 */
defineProps<{ title: string }>()
</script>

<template>
  <section class="panel-chrome flex flex-col overflow-hidden">
    <header
      class="flex min-h-layout-cell items-center gap-2 border-b border-white/8 bg-(--color-layout-header-fill) px-[10px] py-2 select-none"
    >
      <span class="truncate text-layout-md font-semibold text-layout-text">
        {{ title }}
      </span>
    </header>
    <div class="flex-1 overflow-hidden">
      <slot />
    </div>
  </section>
</template>
