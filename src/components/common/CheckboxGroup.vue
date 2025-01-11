<template>
  <div :class="['flex flex-wrap', $attrs.class]">
    <div
      v-for="checkbox in checkboxes"
      :key="checkbox.value"
      class="flex items-center gap-2"
    >
      <Checkbox
        v-model="internalSelection"
        :inputId="checkbox.value"
        :value="checkbox.value"
      />
      <label :for="checkbox.value" class="ml-2">{{ checkbox.label }}</label>
    </div>
  </div>
</template>

<script setup lang="ts">
import Checkbox from 'primevue/checkbox'
import { computed } from 'vue'

interface CheckboxItem {
  label: string
  value: string
}

const props = defineProps<{
  checkboxes: CheckboxItem[]
  modelValue: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

const internalSelection = computed({
  get: () => props.modelValue,
  set: (value: string[]) => emit('update:modelValue', value)
})
</script>
