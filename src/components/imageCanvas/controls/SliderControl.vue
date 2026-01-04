<template>
  <div class="flex flex-col gap-3 pb-3">
    <span class="text-left text-xs font-sans text-[var(--descrip-text)]">{{
      label
    }}</span>
    <input
      type="range"
      class="imageCanvas_sidePanelBrushRange"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      @input="onInput"
    />
  </div>
</template>

<script setup lang="ts">
interface Props {
  label: string
  min: number
  max: number
  step?: number
  modelValue: number
}

withDefaults(defineProps<Props>(), {
  step: 1
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const onInput = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)
  emit('update:modelValue', value)
}
</script>
