<template>
  <SearchInput
    :model-value="internalValue"
    v-bind="$attrs"
    class="w-full"
    :debounce-time="0"
    :invalid="validationState === ValidationState.INVALID"
    @update:model-value="handleInput"
    @blur="handleBlur"
  >
    <template #trailing="{ iconClass, positionClass }">
      <button
        v-show="validationState !== ValidationState.IDLE"
        type="button"
        :class="cn('absolute flex', positionClass)"
        :aria-label="$t('g.validate')"
        :disabled="validationState === ValidationState.LOADING"
        :data-validation-state="validationState"
        @click="validateUrl(props.modelValue)"
      >
        <i :class="cn(validationIcon, iconClass)" />
      </button>
    </template>
  </SearchInput>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import { isValidUrl } from '@/utils/formatUtil'
import { checkUrlReachable } from '@/utils/networkUtil'
import { ValidationState } from '@/utils/validationUtil'

const props = defineProps<{
  modelValue: string
  validateUrlFn?: (url: string) => Promise<boolean>
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
      return 'icon-[lucide--check] text-success-foreground'
    case ValidationState.INVALID:
      return 'icon-[lucide--x] text-destructive-foreground'
    default:
      return undefined
  }
})

const cleanInput = (value: string): string =>
  value ? value.replace(/\s+/g, '') : ''

// Add internal value state
const internalValue = ref(cleanInput(props.modelValue))

// Watch for external modelValue changes
watch(
  () => props.modelValue,
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
  await validateUrl(props.modelValue)
})

const handleInput = (value: string) => {
  const cleaned = cleanInput(value)
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
    const isValid = await (props.validateUrlFn ?? defaultValidateUrl)(url)
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
