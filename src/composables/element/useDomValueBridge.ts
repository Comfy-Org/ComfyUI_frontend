import { ref, watch } from 'vue'
import type { Ref } from 'vue'

type ValueElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

/**
 * Bridges a DOM element's `.value` property to a Vue reactive ref.
 *
 * This composable provides a clean, public API for extension authors to
 * synchronize DOM widget values with Vue reactivity (and by extension, the
 * `widgetValueStore`). It works by:
 *
 * 1. Intercepting programmatic `.value` writes via `Object.defineProperty`
 * 2. Listening for user-driven `input` events on the element
 * 3. Exposing a reactive `Ref<string>` that stays in sync with the DOM
 *
 * When the returned ref is written to, the DOM element's value is updated.
 * When the DOM element's value changes (programmatically or via user input),
 * the ref is updated.
 *
 * @param element - The DOM element to bridge (input, textarea, or select)
 * @returns A reactive ref that stays in sync with the element's value
 *
 * @example
 * ```ts
 * // In a custom widget's getValue/setValue:
 * const bridgedValue = useDomValueBridge(inputEl)
 * const widget = node.addDOMWidget(name, type, inputEl, {
 *   getValue: () => bridgedValue.value,
 *   setValue: (v) => { bridgedValue.value = v }
 * })
 * ```
 */
export function useDomValueBridge(element: ValueElement): Ref<string> {
  const bridgedValue = ref(element.value)

  // Capture the original property descriptor so we can chain through it
  const proto = Object.getPrototypeOf(element)
  const originalDescriptor =
    Object.getOwnPropertyDescriptor(element, 'value') ??
    Object.getOwnPropertyDescriptor(proto, 'value')

  // Intercept programmatic .value writes on the element
  // This catches cases where extensions or libraries set element.value directly
  try {
    Object.defineProperty(element, 'value', {
      get() {
        return originalDescriptor?.get?.call(this) ?? bridgedValue.value
      },
      set(newValue: string) {
        originalDescriptor?.set?.call(this, newValue)
        bridgedValue.value = newValue
      },
      configurable: true,
      enumerable: true
    })
  } catch {
    // If the descriptor is non-configurable, fall back to polling-free sync
    // via input events only
  }

  // Listen for user-driven input events
  element.addEventListener('input', () => {
    // Read through the original descriptor to avoid infinite loops
    const currentValue = originalDescriptor?.get?.call(element) ?? element.value
    bridgedValue.value = currentValue
  })

  // When the ref is written to externally, update the DOM element
  watch(bridgedValue, (newValue) => {
    const currentDomValue =
      originalDescriptor?.get?.call(element) ?? element.value
    if (currentDomValue !== newValue) {
      originalDescriptor?.set?.call(element, newValue)
    }
  })

  return bridgedValue
}
