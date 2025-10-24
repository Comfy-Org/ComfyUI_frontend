import type { LGraphCanvas } from './LGraphCanvas'
import type { IContextMenuValue } from './interfaces'

/**
 * Simple compatibility layer for legacy getCanvasMenuOptions and getNodeMenuOptions monkey patches.
 * To disable legacy support, set ENABLE_LEGACY_SUPPORT = false
 */
const ENABLE_LEGACY_SUPPORT = true

type ContextMenuValueProvider = (...args: unknown[]) => IContextMenuValue[]

class LegacyMenuCompat {
  private originalMethods = new Map<string, ContextMenuValueProvider>()
  private hasWarned = new Set<string>()
  private currentExtension: string | null = null
  private isExtracting = false
  private readonly wrapperMethods = new Map<string, ContextMenuValueProvider>()
  private readonly preWrapperMethods = new Map<
    string,
    ContextMenuValueProvider
  >()
  private readonly wrapperInstalled = new Map<string, boolean>()

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
   * @param methodName The method name
   * @param wrapperFn The wrapper function
   * @param preWrapperFn The method that existed before the wrapper
   * @param prototype The prototype to verify wrapper installation
   */
  registerWrapper(
    methodName: keyof LGraphCanvas,
    wrapperFn: ContextMenuValueProvider,
    preWrapperFn: ContextMenuValueProvider,
    prototype?: LGraphCanvas
  ) {
    this.wrapperMethods.set(methodName, wrapperFn)
    this.preWrapperMethods.set(methodName, preWrapperFn)
    const isInstalled = prototype && prototype[methodName] === wrapperFn
    this.wrapperInstalled.set(methodName, !!isInstalled)
  }

  /**
   * Install compatibility layer to detect monkey-patching
   * @param prototype The prototype to install on
   * @param methodName The method name to track
   */
  install(prototype: LGraphCanvas, methodName: keyof LGraphCanvas) {
    if (!ENABLE_LEGACY_SUPPORT) return

    const originalMethod = prototype[methodName]
    this.originalMethods.set(methodName, originalMethod)

    let currentImpl = originalMethod

    Object.defineProperty(prototype, methodName, {
      get() {
        return currentImpl
      },
      set: (newImpl: ContextMenuValueProvider) => {
        const fnKey = `${methodName}:${newImpl.toString().slice(0, 100)}`
        if (!this.hasWarned.has(fnKey) && this.currentExtension) {
          this.hasWarned.add(fnKey)

          console.warn(
            `%c[DEPRECATED]%c Monkey-patching ${methodName} is deprecated. (Extension: "${this.currentExtension}")\n` +
              `Please use the new context menu API instead.\n\n` +
              `See: https://docs.comfy.org/custom-nodes/js/context-menu-migration`,
            'color: orange; font-weight: bold',
            'color: inherit'
          )
        }
        currentImpl = newImpl
      }
    })
  }

  /**
   * Extract items that were added by legacy monkey patches
   * @param methodName The method name that was monkey-patched
   * @param context The context to call methods with
   * @param args Arguments to pass to the methods
   * @returns Array of menu items added by monkey patches
   */
  extractLegacyItems(
    methodName: keyof LGraphCanvas,
    context: LGraphCanvas,
    ...args: unknown[]
  ): IContextMenuValue[] {
    if (!ENABLE_LEGACY_SUPPORT) return []
    if (this.isExtracting) return []

    const originalMethod = this.originalMethods.get(methodName)
    if (!originalMethod) return []

    try {
      this.isExtracting = true

      const originalItems = originalMethod.apply(context, args) as
        | IContextMenuValue[]
        | undefined
      if (!originalItems) return []

      const currentMethod = context.constructor.prototype[methodName]
      if (!currentMethod || currentMethod === originalMethod) return []

      const registeredWrapper = this.wrapperMethods.get(methodName)
      if (registeredWrapper && currentMethod === registeredWrapper) return []

      const preWrapperMethod = this.preWrapperMethods.get(methodName)
      const wrapperWasInstalled = this.wrapperInstalled.get(methodName)

      const shouldSkipWrapper =
        preWrapperMethod &&
        wrapperWasInstalled &&
        currentMethod !== preWrapperMethod

      const methodToCall = shouldSkipWrapper ? preWrapperMethod : currentMethod

      const patchedItems = methodToCall.apply(context, args) as
        | IContextMenuValue[]
        | undefined
      if (!patchedItems) return []

      if (patchedItems.length > originalItems.length) {
        return patchedItems.slice(originalItems.length) as IContextMenuValue[]
      }

      return []
    } catch (e) {
      console.error('[Context Menu Compat] Failed to extract legacy items:', e)
      return []
    } finally {
      this.isExtracting = false
    }
  }
}

export const legacyMenuCompat = new LegacyMenuCompat()
