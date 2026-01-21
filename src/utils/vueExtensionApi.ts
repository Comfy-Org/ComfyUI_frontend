/**
 * Exposes Vue for external extensions to create Vue components.
 *
 * Usage in extensions:
 * ```js
 * const { h, defineComponent, ref, computed } = window.Vue
 * ```
 */
import * as Vue from 'vue'

declare global {
  interface Window {
    Vue: typeof Vue
  }
}

export function exposeVueApi(): void {
  window.Vue = Vue
}
