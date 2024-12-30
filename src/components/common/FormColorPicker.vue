<template>
  <div class="color-picker-wrapper flex items-center gap-2">
    <ColorPicker v-model="modelValue">
      <template #header>
        <div class="flex items-center justify-between p-2">
          <span>{{ props.label }}</span>
          <Button
            v-if="props.defaultValue"
            icon="pi pi-refresh"
            text
            size="small"
            @click="resetColor"
          />
        </div>
      </template>
    </ColorPicker>
    <InputText v-model="modelValue" class="w-28" :placeholder="label" />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ColorPicker from 'primevue/colorpicker'
import InputText from 'primevue/inputtext'

const modelValue = defineModel<string>('modelValue')
const props = defineProps<{
  defaultValue?: string
  label?: string
}>()

const resetColor = () => {
  modelValue.value = props.defaultValue || '#000000'
}
</script>
