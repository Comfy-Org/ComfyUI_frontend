<template>
  <IconField class="w-full">
    <InputText
      v-bind="$attrs"
      :model-value="modelValue"
      class="w-full"
      :invalid="validationState === UrlValidationState.INVALID"
      @update:model-value="handleInput"
      @blur="validateUrl"
    />
    <InputIcon
      :class="{
        'pi pi-spin pi-spinner text-neutral-400':
          validationState === UrlValidationState.LOADING,
        'pi pi-check text-green-500':
          validationState === UrlValidationState.VALID,
        'pi pi-times text-red-500':
          validationState === UrlValidationState.INVALID
      }"
    />
  </IconField>
</template>

<script setup lang="ts">
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import { ref } from 'vue'

import { isValidUrl } from '@/utils/formatUtil'
import { checkUrlReachable } from '@/utils/networkUtil'

const props = defineProps<{
  modelValue: string
  validateUrlFn?: (url: string) => Promise<boolean>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

enum UrlValidationState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  VALID = 'VALID',
  INVALID = 'INVALID'
}

const validationState = ref<UrlValidationState>(UrlValidationState.IDLE)

const handleInput = (value: string) => {
  emit('update:modelValue', value)
  // Reset validation state when user types
  validationState.value = UrlValidationState.IDLE
}

// Default validation implementation
const defaultValidateUrl = async (url: string): Promise<boolean> => {
  if (!isValidUrl(url)) return false
  try {
    return await checkUrlReachable(url)
  } catch {
    return false
  }
}

const validateUrl = async () => {
  const url = props.modelValue.trim()

  // Reset state
  validationState.value = UrlValidationState.IDLE

  // Skip validation if empty
  if (!url) return

  validationState.value = UrlValidationState.LOADING
  try {
    const isValid = await (props.validateUrlFn ?? defaultValidateUrl)(url)
    validationState.value = isValid
      ? UrlValidationState.VALID
      : UrlValidationState.INVALID
  } catch {
    validationState.value = UrlValidationState.INVALID
  }
}

// Add inheritAttrs option to prevent attrs from being applied to root element
defineOptions({
  inheritAttrs: false
})
</script>
