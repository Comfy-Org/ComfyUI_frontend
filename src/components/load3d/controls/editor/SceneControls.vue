<template>
  <div class="space-y-4">
    <label>
      {{ t('load3d.backgroundColor') }}
    </label>
    <input
      ref="colorPickerRef"
      type="color"
      :value="backgroundColor"
      class="w-full"
      @input="updateBackgroundColor(($event.target as HTMLInputElement).value)"
    />

    <Checkbox
      v-model="showGrid"
      input-id="showGrid"
      binary
      name="showGrid"
      @change="toggleGrid"
    />

    <label for="showGrid" class="pl-2">
      {{ t('load3d.showGrid') }}
    </label>
  </div>
</template>

<script setup lang="ts">
import Checkbox from 'primevue/checkbox'
import { ref, watch } from 'vue'

import { t } from '@/i18n.js'

const emit = defineEmits<{
  (e: 'toggleGrid', value: boolean): void
  (e: 'updateBackgroundColor', color: string): void
  (e: 'updateBackgroundImage', file: File | null): void
}>()

const props = defineProps<{
  backgroundColor: string
  showGrid: boolean
  hasBackgroundImage?: boolean
}>()

const backgroundColor = ref(props.backgroundColor)
const showGrid = ref(props.showGrid)
const colorPickerRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.backgroundColor,
  (newValue) => {
    backgroundColor.value = newValue
  }
)

watch(
  () => props.showGrid,
  (newValue) => {
    showGrid.value = newValue
  }
)

const toggleGrid = () => {
  emit('toggleGrid', showGrid.value)
}

const updateBackgroundColor = (color: string) => {
  emit('updateBackgroundColor', color)
}
</script>
