<template>
  <InputGroup>
    <InputGroupInput
      :model-value="internalValue"
      v-bind="$attrs"
      :disabled
      :aria-invalid="validationState === ValidationState.INVALID"
      @update:model-value="handleInput"
      @blur="handleBlur"
    />
    <InputGroupAddon
      v-show="validationState !== ValidationState.IDLE"
      align="inline-end"
    >
      <InputGroupButton
        size="icon-sm"
        :aria-label="$t('g.validate')"
        :disabled="disabled || validationState === ValidationState.LOADING"
        :data-validation-state="validationState"
        @click="validateUrl(modelValue)"
      >
        <i :class="cn(validationIcon, 'size-4')" />
      </InputGroupButton>
    </InputGroupAddon>
  </InputGroup>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import InputGroup from '@/components/ui/input-group/InputGroup.vue'
import InputGroupAddon from '@/components/ui/input-group/InputGroupAddon.vue'
import InputGroupButton from '@/components/ui/input-group/InputGroupButton.vue'
import InputGroupInput from '@/components/ui/input-group/InputGroupInput.vue'
import { isValidUrl } from '@/utils/formatUtil'
import { checkUrlReachable } from '@/utils/networkUtil'
import { ValidationState } from '@/utils/validationUtil'

const {
  modelValue,
  validateUrlFn,
  disabled = false
} = defineProps<{
  modelValue: string
  validateUrlFn?: (url: string) => Promise<boolean>
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'state-change': [state: ValidationState]
}>()

const validationState = ref<ValidationState>(ValidationState.IDLE)
const validationIcon = computed(() => {
  switch (validationState.value) {
    case ValidationState.LOADING:
      return 'icon-[lucide--loader-circle] animate-spin text-muted-foreground'
    case ValidationState.VALID:
      return 'icon-[lucide--check] text-success-background'
    case ValidationState.INVALID:
      return 'icon-[lucide--x] text-destructive-background'
    default:
      return undefined
  }
})

const cleanInput = (value: string): string =>
  value ? value.replace(/\s+/g, '') : ''

// Add internal value state
const internalValue = ref(cleanInput(modelValue))

// Watch for external modelValue changes
watch(
  () => modelValue,
  async (newValue: string) => {
    internalValue.value = cleanInput(newValue)
    await validateUrl(newValue)
  }
)

watch(validationState, (newState) => {
  emit('state-change', newState)
})

// Validate on mount
onMounted(async () => {
  await validateUrl(modelValue)
})

const handleInput = (value: string | number | undefined) => {
  const cleaned = cleanInput(String(value ?? ''))
  internalValue.value = cleaned
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
  emit('update:modelValue', normalizedUrl)
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
