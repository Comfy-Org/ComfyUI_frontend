import { useSettingStore } from '@/platform/settings/settingStore'

/**
 * Registry for managing Vue number controls with deterministic execution timing.
 * Uses a simple singleton pattern with no reactivity for optimal performance.
 */
export class NumberControlRegistry {
  private controls = new Map<symbol, () => void>()

  /**
   * Register a number control callback
   */
  register(id: symbol, applyFn: () => void): void {
    this.controls.set(id, applyFn)
  }

  /**
   * Unregister a number control callback
   */
  unregister(id: symbol): void {
    this.controls.delete(id)
  }

  /**
   * Execute all registered controls for the given phase
   */
  executeControls(phase: 'before' | 'after'): void {
    const settingStore = useSettingStore()
    if (settingStore.get('Comfy.WidgetControlMode') === phase) {
      for (const applyFn of this.controls.values()) {
        applyFn()
      }
    }
  }

  /**
   * Get the number of registered controls (for testing)
   */
  getControlCount(): number {
    return this.controls.size
  }

  /**
   * Clear all registered controls (for testing)
   */
  clear(): void {
    this.controls.clear()
  }
}

// Global singleton instance
export const numberControlRegistry = new NumberControlRegistry()

/**
 * Public API function to execute number controls
 */
export function executeNumberControls(phase: 'before' | 'after'): void {
  numberControlRegistry.executeControls(phase)
}
