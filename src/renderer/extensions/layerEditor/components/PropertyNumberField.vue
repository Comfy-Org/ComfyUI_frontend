<template>
  <label
    class="flex min-w-0 flex-1 items-center gap-1 rounded-md border border-border-default bg-secondary-background px-1.5 py-1"
  >
    <span class="shrink-0 text-xs text-muted-foreground">{{ label }}</span>
    <Input
      v-model="draft"
      type="number"
      :min
      :max
      :step
      class="h-auto [appearance:textfield] rounded-none bg-transparent p-0 text-xs focus-visible:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      @change="onChange"
    />
  </label>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import Input from '@/components/ui/input/Input.vue'

const {
  label,
  value,
  min,
  max,
  step = 1
} = defineProps<{
  label: string
  value: number
  min?: number
  max?: number
  step?: number
}>()

const emit = defineEmits<{ commit: [value: number] }>()

const draft = ref<string | number>(value)

watch(
  () => value,
  (next) => {
    draft.value = next
  }
)

function onChange(): void {
  const raw = draft.value
  const next =
    typeof raw === 'string' && raw.trim() === '' ? Number.NaN : Number(raw)
  if (Number.isFinite(next)) {
    const low = min ?? -Infinity
    const high = max ?? Infinity
    emit('commit', Math.min(high, Math.max(low, next)))
  }
  void nextTick(() => {
    draft.value = value
  })
}
</script>
