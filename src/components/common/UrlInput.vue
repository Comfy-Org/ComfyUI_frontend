<template>
  <IconField class="w-full">
    <InputText
      v-bind="$attrs"
      :model-value="internalValue"
      class="w-full"
      :invalid="validationState === ValidationState.INVALID"
      @update:model-value="handleInput"
      @blur="handleBlur"
    />
    <InputIcon
      :class="{
        'pi pi-spin pi-spinner text-neutral-400':
          validationState === ValidationState.LOADING,
        'pi pi-check cursor-pointer text-green-500':
          validationState === ValidationState.VALID,
        'pi pi-times cursor-pointer text-red-500':
          validationState === ValidationState.INVALID
      }"
      @click="validateUrl(model)"
    />
  </IconField>
</template>

<script setup lang="ts">
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import { onMounted, ref, watch } from 'vue'

import { isValidUrl } from '@/utils/formatUtil'
import { checkUrlReachable } from '@/utils/networkUtil'
import { ValidationState } from '@/utils/validationUtil'

const model = defineModel<string>({ required: true })

const { validateUrlFn } = defineProps<{
  validateUrlFn?: (url: string) => Promise<boolean>
}>()

const emit = defineEmits<{
  'state-change': [state: ValidationState]
}>()

const validationState = ref<ValidationState>(ValidationState.IDLE)

const cleanInput = (value: string): string =>
  value ? value.replaceAll(/\s+/g, '') : ''

const internalValue = ref(cleanInput(model.value))

watch(model, async (newValue: string) => {
  internalValue.value = cleanInput(newValue)
  await validateUrl(newValue)
})

watch(validationState, (newState) => {
  emit('state-change', newState)
})

onMounted(async () => {
  await validateUrl(model.value)
})

const handleInput = (value: string | undefined) => {
  // Update internal value without emitting
  internalValue.value = cleanInput(value ?? '')
  // Reset validation state when user types
  validationState.value = ValidationState.IDLE
}

const handleBlur = async () => {
  const input = cleanInput(internalValue.value)

  let normalizedUrl = input
  try {
    const url = new URL(input)
    normalizedUrl = url.toString()
  } catch {
    // If URL parsing fails, just use the cleaned input
  }

  // Emit the update only on blur
  model.value = normalizedUrl
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

const validateUrl = async (value: string) => {
  if (validationState.value === ValidationState.LOADING) return

  const url = cleanInput(value)

  // Reset state
  validationState.value = ValidationState.IDLE

  // Skip validation if empty
  if (!url) return

  validationState.value = ValidationState.LOADING
  try {
    const isValid = await (validateUrlFn ?? defaultValidateUrl)(url)
    validationState.value = isValid
      ? ValidationState.VALID
      : ValidationState.INVALID
  } catch {
    validationState.value = ValidationState.INVALID
  }
}

// Add inheritAttrs option to prevent attrs from being applied to root element
defineOptions({
  inheritAttrs: false
})
</script>
