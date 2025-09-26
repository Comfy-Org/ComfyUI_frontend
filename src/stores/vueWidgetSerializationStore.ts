/**
 * Store for managing Vue widget serialization functions.
 * This allows Vue components to register serialization handlers that can be
 * accessed by LiteGraph widgets for workflow saving/loading.
 */

type SerializationFunction = () => Promise<string>

class VueWidgetSerializationStore {
  private registry = new Map<string, SerializationFunction>()

  /**
   * Register a serialization function for a widget
   * @param key Unique identifier for the widget (e.g., "{nodeId}-{widgetName}")
   * @param serializeFn Function that serializes the widget value
   */
  register(key: string, serializeFn: SerializationFunction): void {
    this.registry.set(key, serializeFn)
  }

  /**
   * Unregister a serialization function
   * @param key The key used during registration
   */
  unregister(key: string): void {
    this.registry.delete(key)
  }

  /**
   * Get a serialization function for a widget
   * @param key The key to look up
   * @returns The serialization function if found, undefined otherwise
   */
  get(key: string): SerializationFunction | undefined {
    return this.registry.get(key)
  }

  /**
   * Check if a serialization function is registered
   * @param key The key to check
   * @returns True if registered, false otherwise
   */
  has(key: string): boolean {
    return this.registry.has(key)
  }

  /**
   * Clear all registered serialization functions
   */
  clear(): void {
    this.registry.clear()
  }

  /**
   * Get all registered keys (useful for debugging)
   */
  getKeys(): string[] {
    return Array.from(this.registry.keys())
  }
}

// Create singleton instance
export const vueWidgetSerializationStore = new VueWidgetSerializationStore()

// Export convenience functions for backward compatibility
export function registerVueWidgetSerialization(
  key: string,
  serializeFn: SerializationFunction
): void {
  vueWidgetSerializationStore.register(key, serializeFn)
}

export function unregisterVueWidgetSerialization(key: string): void {
  vueWidgetSerializationStore.unregister(key)
}
