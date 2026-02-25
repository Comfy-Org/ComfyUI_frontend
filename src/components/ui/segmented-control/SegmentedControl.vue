<template>
  <ToggleGroup
    type="single"
    variant="pill"
    :model-value="modelValue"
    data-testid="segmented-control"
    @update:model-value="modelValue = $event as string"
  >
    <ToggleGroupItem v-for="option in options" :key="option" :value="option">
      {{ option }}
    </ToggleGroupItem>
  </ToggleGroup>
</template>

<script setup lang="ts">
/**
 * A pill-shaped segmented control with a dark background and white active
 * indicator. Accepts an array of string labels and exposes the selected
 * value via `v-model`.
 *
 * @example
 * ```vue
 * <SegmentedControl v-model="size" :options="['Small', 'Medium', 'Large']" />
 * ```
 */
import ToggleGroup from '@/components/ui/toggle-group/ToggleGroup.vue'
import ToggleGroupItem from '@/components/ui/toggle-group/ToggleGroupItem.vue'

defineProps<{
  /** Labels to display as selectable segments. */
  options: string[]
}>()

/** The currently selected option value. */
const modelValue = defineModel<string>()
</script>
