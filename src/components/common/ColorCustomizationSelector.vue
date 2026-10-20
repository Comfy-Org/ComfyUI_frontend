<template>
  <div class="color-customization-selector-container flex items-center gap-2">
    <ToggleGroup v-model="selectedColorName" type="single" :allow-empty="false">
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
      v-if="selectedColorName === '_custom'"
      v-model="customColorValue"
      :hex-label="$t('color.hex')"
      :rgba-label="$t('color.rgba')"
      :hue-label="$t('color.hue')"
      :alpha-label="$t('color.alpha')"
      :red-label="$t('color.red')"
      :green-label="$t('color.green')"
      :blue-label="$t('color.blue')"
      :saturation-brightness-label="$t('color.saturationBrightness')"
      :format-label="$t('g.color')"
      :accessible-label="$t('g.color')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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

const initialColorOption = colorOptions.find(
  (option) => option.value === modelValue
)
const selectedColorName = ref(
  initialColorOption?.name ?? customColorOption.name
)
const customColorValue = ref(initialColorOption ? '' : (modelValue ?? ''))

watch(selectedColorName, (newName, oldName) => {
  const newOption = colorOptionsWithCustom.value.find(
    (option) => option.name === newName
  )
  if (!newOption) return

  if (newName === customColorOption.name) {
    customColorValue.value =
      colorOptionsWithCustom.value.find((option) => option.name === oldName)
        ?.value ?? ''
  } else {
    emit('update:modelValue', newOption.value)
  }
})

watch(customColorValue, (newValue) => {
  if (selectedColorName.value === customColorOption.name) {
    emit('update:modelValue', newValue || null)
  }
})
</script>
