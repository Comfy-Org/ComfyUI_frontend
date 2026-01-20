<template>
  <div class="relative flex min-h-6 flex-row items-center gap-2.5">
    <span class="text-left font-sans text-xs text-[var(--descrip-text)]">{{
      label
    }}</span>
    <label class="maskEditor_sidePanelToggleContainer">
      <input
        type="checkbox"
        class="maskEditor_sidePanelToggleCheckbox"
        :checked="modelValue"
        @change="onChange"
      >
      <div class="maskEditor_sidePanelToggleSwitch" />
    </label>
  </div>
</template>

<script setup lang="ts">
interface Props {
  label: string
  modelValue: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const onChange = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked
  emit('update:modelValue', checked)
}
</script>
