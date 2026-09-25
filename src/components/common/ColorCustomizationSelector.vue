<template>
  <div class="color-customization-selector-container flex items-center gap-2">
    <ToggleGroup v-model="selectedColorName" type="single">
      <ToggleGroupItem
        v-for="option in colorOptionsWithCustom"
        :key="option.name"
        :value="option.name"
        :aria-label="
          option.name === '_custom' ? t('color.custom') : option.name
        "
      >
        <div
          v-if="option.name !== '_custom'"
          :style="{
            width: '20px',
            height: '20px',
            backgroundColor: option.value,
            borderRadius: '50%'
          }"
        />
        <i v-else class="pi pi-palette text-lg" />
      </ToggleGroupItem>
    </ToggleGroup>
    <ColorPicker
      v-if="selectedColorOption.name === '_custom'"
      v-model="customColorValue"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ColorPicker from '@/components/ui/color-picker/ColorPicker.vue'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const { t } = useI18n()

const {
  modelValue,
  colorOptions,
  allowCustom = true
} = defineProps<{
  modelValue: string | null
  colorOptions: { name: Exclude<string, '_custom'>; value: string }[]
  allowCustom?: boolean
}>()

const customColorOption = { name: '_custom', value: '' }
const colorOptionsWithCustom = computed(() => [
  ...colorOptions,
  ...(allowCustom ? [customColorOption] : [])
])

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const selectedColorOption = ref(customColorOption)
const selectedColorName = computed({
  get: () => selectedColorOption.value.name,
  set: (name: string) => {
    selectedColorOption.value =
      colorOptionsWithCustom.value.find((option) => option.name === name) ??
      selectedColorOption.value
  }
})
const customColorValue = ref('')

// Initialize the component with the provided modelValue
onMounted(() => {
  if (modelValue) {
    const predefinedColor = colorOptions.find((opt) => opt.value === modelValue)
    if (predefinedColor) {
      selectedColorOption.value = predefinedColor
    } else {
      selectedColorOption.value = customColorOption
      customColorValue.value = modelValue
    }
  }
})

// Watch for changes in selection and emit updates
watch(selectedColorOption, (newOption, oldOption) => {
  if (newOption.name === '_custom') {
    // Inherit the color from previous selection
    customColorValue.value = oldOption.value
  } else {
    emit('update:modelValue', newOption.value)
  }
})

watch(customColorValue, (newValue) => {
  if (selectedColorOption.value.name === '_custom') {
    emit('update:modelValue', newValue || null)
  }
})
</script>
