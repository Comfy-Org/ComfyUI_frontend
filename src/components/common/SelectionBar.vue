<template>
  <div class="relative mx-2">
    <div
      class="absolute bottom-6 left-1/2 z-40 flex w-full max-w-78 -translate-x-1/2 items-center gap-2 rounded-lg bg-base-foreground p-2 text-base-background shadow-interface"
    >
      <Button
        v-tooltip.top="{ value: deselectLabel, showDelay: 300 }"
        variant="inverted"
        size="icon-lg"
        type="button"
        :aria-label="deselectLabel"
        class="rounded-lg hover:bg-base-background/10"
        @click="emit('deselect')"
      >
        <i class="icon-[lucide--x] size-4" />
      </Button>
      <span class="pr-6 text-sm font-bold whitespace-nowrap tabular-nums">
        {{ label }}
      </span>
      <div class="ml-auto flex shrink-0 items-center gap-1">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

defineProps<{
  /** The "N selected" text; the caller formats it (pluralization, wording). */
  label: string
  /** Accessible label + tooltip for the deselect button. */
  deselectLabel: string
}>()

const emit = defineEmits<{
  deselect: []
}>()
</script>
