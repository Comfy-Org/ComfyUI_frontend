import type { IContextMenuValue } from './interfaces'

/**
 * Simple compatibility layer for legacy getCanvasMenuOptions and getNodeMenuOptions monkey patches.
 * To disable legacy support, set ENABLE_LEGACY_SUPPORT = false
 */
const ENABLE_LEGACY_SUPPORT = true

type AnyFunction = (...args: any[]) => any

class LegacyMenuCompat {
  private originalMethods = new Map<string, AnyFunction>()
  private hasWarned = new Set<string>()
  private currentExtension: string | null = null
  private isExtracting = false
  private wrapperMethods = new Map<string, AnyFunction>()

  /**
   * Set the name of the extension that is currently being set up.
   * This allows us to track which extension is monkey-patching.
   * @param extensionName The name of the extension
   */
  setCurrentExtension(extensionName: string | null) {
    this.currentExtension = extensionName
  }

  /**
   * Register a wrapper method that should NOT be treated as a legacy monkey-patch.
   * This is for internal wrappers that add new API items.
   * @param methodName The method name
   * @param wrapperFn The wrapper function
   */
  registerWrapper(methodName: string, wrapperFn: AnyFunction) {
    this.wrapperMethods.set(methodName, wrapperFn)
  }

  /**
   * Install compatibility layer to detect monkey-patching
   * @param prototype The prototype to install on (e.g., LGraphCanvas.prototype)
   * @param methodName The method name to track (e.g., 'getCanvasMenuOptions')
   */
  install(prototype: any, methodName: string) {
    if (!ENABLE_LEGACY_SUPPORT) return

    // Store original
    const originalMethod = prototype[methodName]
    this.originalMethods.set(methodName, originalMethod)

    // Wrap with getter/setter to detect patches
    let currentImpl = originalMethod

    Object.defineProperty(prototype, methodName, {
      get() {
        return currentImpl
      },
      set: (newImpl: AnyFunction) => {
        // Log once per unique function
        const fnKey = `${methodName}:${newImpl.toString().slice(0, 100)}`
        if (!this.hasWarned.has(fnKey)) {
          this.hasWarned.add(fnKey)

          const extensionInfo = this.currentExtension
            ? ` (Extension: "${this.currentExtension}")`
            : ''

          console.warn(
            `%c[DEPRECATED]%c Monkey-patching ${methodName} is deprecated.${extensionInfo}\n` +
              `Please use the new context menu API instead.\n\n` +
              `See: https://docs.comfy.org/custom-nodes/js/context-menu-migration`,
            'color: orange; font-weight: bold',
            'color: inherit'
          )
        }
        currentImpl = newImpl
      },
      configurable: true
    })
  }

  /**
   * Extract items that were added by legacy monkey patches
   * @param methodName The method name that was monkey-patched
   * @param context The context to call methods with (e.g., canvas instance)
   * @param args Arguments to pass to the methods
   * @returns Array of menu items added by monkey patches
   */
  extractLegacyItems(
    methodName: string,
    context: any,
    ...args: any[]
  ): IContextMenuValue[] {
    if (!ENABLE_LEGACY_SUPPORT) return []

    // Prevent infinite recursion - if we're already extracting, return empty
    if (this.isExtracting) return []

    const originalMethod = this.originalMethods.get(methodName)
    if (!originalMethod) return []

    try {
      // Set flag to prevent infinite recursion
      this.isExtracting = true

      // Get baseline from original
      const originalItems = originalMethod.apply(context, args) as
        | IContextMenuValue[]
        | undefined
      if (!originalItems) return []

      // Get current method (potentially patched)
      const currentMethod = context.constructor.prototype[methodName]
      if (!currentMethod || currentMethod === originalMethod) return []

      // If current method is a registered wrapper, don't extract items from it
      // (the wrapper already handles new API items directly)
      const registeredWrapper = this.wrapperMethods.get(methodName)
      if (registeredWrapper && currentMethod === registeredWrapper) return []

      // Get items from patched method
      const patchedItems = currentMethod.apply(context, args) as
        | IContextMenuValue[]
        | undefined
      if (!patchedItems) return []

      // Return items that were added (simple slice approach)
      if (patchedItems.length > originalItems.length) {
        return patchedItems.slice(originalItems.length)
      }

      return []
    } catch (e) {
      console.error('[Context Menu Compat] Failed to extract legacy items:', e)
      return []
    } finally {
      // Always reset the flag
      this.isExtracting = false
    }
  }
}

export const legacyMenuCompat = new LegacyMenuCompat()
