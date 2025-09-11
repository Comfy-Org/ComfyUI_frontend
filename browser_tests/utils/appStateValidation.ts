/**
 * Shared utilities for validating ComfyUI app state
 *
 * Centralizes repeated app state checking logic to improve maintainability
 * and provide consistent validation across different state machines.
 */

export interface ComfyAppState {
  app: boolean
  graph: boolean
  extensionManager: boolean
}

/**
 * Check if the ComfyUI app core objects are present and initialized
 * This validates the basic structure needed for most operations
 */
export function validateComfyAppState(): ComfyAppState | null {
  try {
    const app = window['app']

    if (!app) {
      return null
    }

    return {
      app: !!app,
      graph: !!app.graph,
      extensionManager: !!app.extensionManager
    }
  } catch {
    return null
  }
}

/**
 * Check if the ComfyUI app is fully initialized and ready for operations
 * This is the most common check pattern across state machines
 */
export function isComfyAppFullyInitialized(): boolean {
  const state = validateComfyAppState()
  return !!(state?.app && state?.graph && state?.extensionManager)
}

/**
 * Get the ComfyUI app instance with null safety
 * Returns null if the app is not available or properly initialized
 */
export function getComfyApp(): any | null {
  try {
    const app = window['app']
    return app && app.graph && app.extensionManager ? app : null
  } catch {
    return null
  }
}

/**
 * Get the ComfyUI graph instance with null safety
 * Returns null if the graph is not available
 */
export function getComfyGraph(): any | null {
  try {
    const app = getComfyApp()
    return app?.graph || null
  } catch {
    return null
  }
}
