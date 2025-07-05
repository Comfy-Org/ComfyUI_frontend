/**
 * Composable for managing widget value synchronization between Vue and LiteGraph
 * Provides consistent pattern for immediate UI updates and LiteGraph callbacks
 */
import { type Ref, ref, watch } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

export interface UseWidgetValueOptions<T, U = T> {
  /** The widget configuration from LiteGraph */
  widget: SimplifiedWidget<T>
  /** The current value from parent component */
  modelValue: T
  /** Default value if modelValue is null/undefined */
  defaultValue: T
  /** Emit function from component setup */
  emit: (event: 'update:modelValue', value: T) => void
  /** Optional value transformer before sending to LiteGraph */
  transform?: (value: U) => T
}

export interface UseWidgetValueReturn<T, U = T> {
  /** Local value for immediate UI updates */
  localValue: Ref<T>
  /** Handler for user interactions */
  onChange: (newValue: U) => void
}

/**
 * Manages widget value synchronization with LiteGraph
 *
 * @example
 * ```vue
 * const { localValue, onChange } = useWidgetValue({
 *   widget: props.widget,
 *   modelValue: props.modelValue,
 *   defaultValue: ''
 * })
 * ```
 */
export function useWidgetValue<T, U = T>({
  widget,
  modelValue,
  defaultValue,
  emit,
  transform
}: UseWidgetValueOptions<T, U>): UseWidgetValueReturn<T, U> {
  // Local value for immediate UI updates
  const localValue = ref<T>(modelValue ?? defaultValue)

  // Handle user changes
  const onChange = (newValue: U) => {
    // Handle different PrimeVue component signatures
    let processedValue: T
    if (transform) {
      processedValue = transform(newValue)
    } else {
      // Ensure type safety - only cast when types are compatible
      if (
        typeof newValue === typeof defaultValue ||
        newValue === null ||
        newValue === undefined
      ) {
        processedValue = (newValue ?? defaultValue) as T
      } else {
        console.warn(
          `useWidgetValue: Type mismatch for widget ${widget.name}. Expected ${typeof defaultValue}, got ${typeof newValue}`
        )
        processedValue = defaultValue
      }
    }

    // 1. Update local state for immediate UI feedback
    localValue.value = processedValue

    // 2. Emit to parent component
    emit('update:modelValue', processedValue)

    // 3. Call LiteGraph callback to update authoritative state
    if (widget.callback) {
      widget.callback(processedValue)
    }
  }

  // Watch for external updates from LiteGraph
  watch(
    () => modelValue,
    (newValue) => {
      localValue.value = newValue ?? defaultValue
    }
  )

  return {
    localValue: localValue as Ref<T>,
    onChange
  }
}

/**
 * Type-specific helper for string widgets
 */
export function useStringWidgetValue(
  widget: SimplifiedWidget<string>,
  modelValue: string,
  emit: (event: 'update:modelValue', value: string) => void
) {
  return useWidgetValue({
    widget,
    modelValue,
    defaultValue: '',
    emit,
    transform: (value: string | undefined) => String(value || '') // Handle undefined from PrimeVue
  })
}

/**
 * Type-specific helper for number widgets
 */
export function useNumberWidgetValue(
  widget: SimplifiedWidget<number>,
  modelValue: number,
  emit: (event: 'update:modelValue', value: number) => void
) {
  return useWidgetValue({
    widget,
    modelValue,
    defaultValue: 0,
    emit,
    transform: (value: number | number[]) => {
      // Handle PrimeVue Slider which can emit number | number[]
      if (Array.isArray(value)) {
        return value.length > 0 ? value[0] ?? 0 : 0
      }
      return Number(value) || 0
    }
  })
}

/**
 * Type-specific helper for boolean widgets
 */
export function useBooleanWidgetValue(
  widget: SimplifiedWidget<boolean>,
  modelValue: boolean,
  emit: (event: 'update:modelValue', value: boolean) => void
) {
  return useWidgetValue({
    widget,
    modelValue,
    defaultValue: false,
    emit,
    transform: (value: boolean) => Boolean(value)
  })
}
