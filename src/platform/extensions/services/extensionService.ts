import { once } from 'es-toolkit'
import type { WatchHandle } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { legacyMenuCompat } from '@/lib/litegraph/src/contextMenuCompat'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import { KeybindingImpl } from '@comfyorg/keybindings/keybinding'
import { useKeybindingStore } from '@comfyorg/keybindings/keybindingStore'
import { useMenuItemStore } from '@/stores/menuItemStore'
import { useWidgetStore } from '@/stores/widgetStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import type { ComfyApp, ComfyExtension } from '@/types/comfy'
import type { AuthUserInfo } from '@/types/authTypes'
import { useApp } from '@/scripts/appInstance'
import { provideExtensionService } from '@/platform/extensions/services/extensionServiceAccess'

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    value instanceof Promise ||
    (typeof value === 'object' &&
      value !== null &&
      typeof (value as { then?: unknown }).then === 'function')
  )
}

const graphLoadLifecycleHooks = new Set<string>([
  'beforeLoadGraph',
  'beforeConfigureGraph',
  'afterConfigureGraph',
  'afterLoadGraph',
  'onGraphLoadError'
] satisfies (keyof ComfyExtension)[])

const graphLoadEntrypoints = [
  'loadGraphData',
  'loadApiJson'
] satisfies (keyof ComfyApp)[]

/**
 * One token per in-flight `handleFile` call a graph-load hook started, keyed by
 * the file it was started with.
 *
 * Provenance rides on the argument rather than on a window of time. An
 * extension may install an async forwarding wrapper on `app.handleFile` that
 * awaits before it delegates, and anything scoped to the synchronous entry of
 * the call has already ended by then: the real handler would see an
 * independent caller and queue the nested graph behind the hook that is
 * waiting for it, stalling every later load. Keying on the file also leaves
 * independent callers alone, because their file was never marked.
 */
const graphLoadHookOriginFiles = new WeakMap<File, Set<object>>()

/**
 * True once, for a `handleFile` call a graph-load hook started with this file.
 * Reading clears the mark, so a later independent call carrying the same file
 * is not refused.
 *
 * Only `handleFile` needs this, because that entrypoint still accepts non-graph
 * media from a hook and so cannot be refused at the proxy.
 */
export function consumeGraphLoadHookOrigin(file: File): boolean {
  const pending = graphLoadHookOriginFiles.get(file)
  const token: object | undefined = pending?.values().next().value
  if (!pending || token === undefined) return false
  pending.delete(token)
  if (pending.size === 0) graphLoadHookOriginFiles.delete(file)
  return true
}

/**
 * Marks `file` as hook-originated. The returned release drops the mark if it
 * was never consumed, so a wrapper that swallows the call cannot leave the file
 * marked for whoever hands it over next.
 */
function markGraphLoadHookOrigin(file: File): () => void {
  const token = {}
  const pending = graphLoadHookOriginFiles.get(file) ?? new Set<object>()
  pending.add(token)
  graphLoadHookOriginFiles.set(file, pending)
  return () => {
    const current = graphLoadHookOriginFiles.get(file)
    if (!current?.delete(token)) return
    if (current.size === 0) graphLoadHookOriginFiles.delete(file)
  }
}

function createGraphLoadHookDispatch(app: ComfyApp) {
  let dispatching = true
  const overrides = new Map<PropertyKey, unknown>()
  for (const name of graphLoadEntrypoints) {
    const original = app[name]
    overrides.set(name, (...args: unknown[]) =>
      dispatching ? Promise.resolve(false) : Reflect.apply(original, app, args)
    )
  }
  {
    const original = app.handleFile
    overrides.set('handleFile', async (...args: unknown[]) => {
      const [file] = args
      if (!dispatching || !(file instanceof File))
        return Reflect.apply(original, app, args)
      const release = markGraphLoadHookOrigin(file)
      try {
        return await Reflect.apply(original, app, args)
      } finally {
        release()
      }
    })
  }
  const hookApp = new Proxy(app, {
    get(target, property) {
      const override = overrides.get(property)
      if (override !== undefined) return override
      const value: unknown = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    }
  })
  return {
    hookApp,
    endDispatch: () => {
      dispatching = false
    }
  }
}

function createSetupHookApp(app: ComfyApp, extensionName: string): ComfyApp {
  const manager = Object(app.extensionManager) as ComfyApp['extensionManager']
  const extensionManager = new Proxy(manager, {
    get(target, property) {
      if (property === 'registerSidebarTab') {
        return (tab: Parameters<typeof target.registerSidebarTab>[0]) => {
          const attributedManager = target as typeof target & {
            registerSidebarTabForExtension?: (
              tab: Parameters<typeof target.registerSidebarTab>[0],
              extensionName: string
            ) => void
          }
          return attributedManager.registerSidebarTabForExtension
            ? attributedManager.registerSidebarTabForExtension(
                tab,
                extensionName
              )
            : target.registerSidebarTab(tab)
        }
      }
      const value: unknown = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    }
  })
  return new Proxy(app, {
    get(target, property) {
      if (property === 'extensionManager') return extensionManager
      const value: unknown = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    }
  })
}

type StartupHook =
  | 'init'
  | 'addCustomNodeDefs'
  | 'registerCustomNodes'
  | 'setup'

export interface StartupHookFailure {
  extension: ComfyExtension
  method: StartupHook
  error: unknown
}

export const useExtensionService = () => {
  const extensionStore = useExtensionStore()
  const settingStore = useSettingStore()
  const keybindingStore = useKeybindingStore()
  const {
    wrapWithErrorHandling,
    wrapWithErrorHandlingAsync,
    toastErrorHandler
  } = useErrorHandling()

  /**
   * Register an extension with the app.
   * @returns A disposer that stops the extension's auth hooks and unregisters it.
   */
  const registerExtension = (extension: ComfyExtension) => {
    if (extensionStore.isHoldingCustomNodes) {
      extensionStore.holdCustomNode(extension)
      return once(() => extensionStore.releaseHeldCustomNode(extension))
    }
    return registerExtensionNow(extension)
  }

  /** Registers an extension even while new ones are held. */
  const registerExtensionNow = (extension: ComfyExtension) => {
    extensionStore.registerExtension(extension)

    const addKeybinding = wrapWithErrorHandling(
      keybindingStore.addDefaultKeybinding
    )
    const addSetting = wrapWithErrorHandling(settingStore.addSetting)

    extension.keybindings?.forEach((keybinding) => {
      addKeybinding(new KeybindingImpl(keybinding))
    })
    useCommandStore().loadExtensionCommands(extension)
    useMenuItemStore().loadExtensionMenuCommands(extension)
    extension.settings?.forEach(addSetting)
    useBottomPanelStore().registerExtensionBottomPanelTabs(extension)
    if (extension.getCustomWidgets) {
      void (async () => {
        if (extension.getCustomWidgets) {
          const widgets = await extension.getCustomWidgets(useApp())
          useWidgetStore().registerCustomWidgets(widgets)
        }
      })()
    }

    const authHookHandles: WatchHandle[] = []

    if (extension.onAuthUserResolved) {
      const { onUserResolved } = useCurrentUser()
      const handleUserResolved = wrapWithErrorHandlingAsync(
        (user: AuthUserInfo) => extension.onAuthUserResolved?.(user, useApp()),
        (error) => {
          console.error('[Extension Auth Hook Error]', {
            extension: extension.name,
            hook: 'onAuthUserResolved',
            error
          })
          toastErrorHandler(error)
        }
      )
      authHookHandles.push(
        onUserResolved((user) => {
          void handleUserResolved(user)
        })
      )
    }

    if (extension.onAuthTokenRefreshed) {
      const { onTokenRefreshed } = useCurrentUser()
      const handleTokenRefreshed = wrapWithErrorHandlingAsync(
        () => extension.onAuthTokenRefreshed?.(),
        (error) => {
          console.error('[Extension Auth Hook Error]', {
            extension: extension.name,
            hook: 'onAuthTokenRefreshed',
            error
          })
          toastErrorHandler(error)
        }
      )
      authHookHandles.push(
        onTokenRefreshed(() => {
          void handleTokenRefreshed()
        })
      )
    }

    if (extension.onAuthUserLogout) {
      const { onUserLogout } = useCurrentUser()
      const handleUserLogout = wrapWithErrorHandlingAsync(
        () => extension.onAuthUserLogout?.(),
        (error) => {
          console.error('[Extension Auth Hook Error]', {
            extension: extension.name,
            hook: 'onAuthUserLogout',
            error
          })
          toastErrorHandler(error)
        }
      )
      authHookHandles.push(
        onUserLogout(() => {
          void handleUserLogout()
        })
      )
    }

    return once(() => {
      authHookHandles.forEach((stop) => stop())
      extensionStore.unregisterExtension(extension.name)
    })
  }

  type RemoveLastAppParam<T> = T extends (
    ...args: [...infer Rest, ComfyApp]
  ) => infer R
    ? (...args: Rest) => R
    : T

  type KnownExtensionMethods = Exclude<keyof ComfyExtension, number | symbol>

  type ComfyExtensionMethod<T extends KnownExtensionMethods> =
    ComfyExtension[T] extends (...args: unknown[]) => unknown
      ? ComfyExtension[T]
      : (...args: unknown[]) => unknown

  type ComfyExtensionParamsWithoutApp<T extends KnownExtensionMethods> =
    RemoveLastAppParam<ComfyExtensionMethod<T>>
  /**
   * Invoke an extension callback
   * @param {keyof ComfyExtension} method The extension callback to execute
   * @param  {unknown[]} args Any arguments to pass to the callback
   * @returns
   */
  const invokeExtensions = <T extends KnownExtensionMethods>(
    method: T,
    ...args: Parameters<ComfyExtensionParamsWithoutApp<T>>
  ) => {
    const results: ReturnType<ComfyExtensionMethod<T>>[] = []
    for (const ext of extensionStore.enabledExtensions) {
      if (method in ext) {
        try {
          const fn = ext[method]
          if (typeof fn === 'function') {
            results.push(fn.call(ext, ...args, useApp()))
          }
        } catch (error) {
          console.error(
            `Error calling extension '${ext.name}' method '${method}'`,
            { error },
            { extension: ext },
            { args }
          )
        }
      }
    }
    return results
  }

  /**
   * Invoke an async extension callback
   * Each callback will be invoked concurrently, in extension order. Only
   * extensions that define the callback do any work, and only promises that
   * callbacks actually return are awaited (callbacks that return
   * synchronously are never wrapped in a promise). The resolved array holds
   * the results of the callbacks that ran, so it is not index-aligned with
   * the extensions.
   * @param {string} method The extension callback to execute
   * @param  {...unknown} args Any arguments to pass to the callback
   * @returns
   */
  const invokeExtensionsAsync = async <T extends KnownExtensionMethods>(
    method: T,
    ...args: Parameters<ComfyExtensionParamsWithoutApp<T>>
  ) => {
    const graphLoadDispatch = graphLoadLifecycleHooks.has(method)
      ? createGraphLoadHookDispatch(useApp())
      : undefined
    const app = graphLoadDispatch?.hookApp ?? useApp()
    const logError = (ext: ComfyExtension, error: unknown) =>
      console.error(
        `Error calling extension '${ext.name}' method '${method}'`,
        { error },
        { extension: ext },
        { args }
      )

    // This runs once per node def per extension, so avoid allocating promises
    // or closures for extensions that do not define the hook.
    const pending: unknown[] = []
    for (const ext of extensionStore.enabledExtensions) {
      // The property read is inside the try so a throwing getter or Proxy trap
      // only affects its own extension.
      try {
        const fn = ext[method]
        if (typeof fn !== 'function') continue

        if (method === 'setup') {
          // Track the current extension for legacy compatibility
          pending.push(
            (async () => {
              legacyMenuCompat.setCurrentExtension(ext.name)
              try {
                return await fn.call(
                  ext,
                  ...args,
                  createSetupHookApp(app, ext.name)
                )
              } finally {
                legacyMenuCompat.setCurrentExtension(null)
              }
            })().catch((error) => logError(ext, error))
          )
          continue
        }

        const result: unknown = fn.call(ext, ...args, app)
        pending.push(
          isPromiseLike(result)
            ? Promise.resolve(result).catch((error) => logError(ext, error))
            : result
        )
      } catch (error) {
        logError(ext, error)
      }
    }
    try {
      return await Promise.all(pending)
    } finally {
      graphLoadDispatch?.endDispatch()
    }
  }

  /** Runs one startup step on the given extensions only, in order; returns the ones that threw. */
  const invokeStartupHook = async <T extends StartupHook>(
    extensions: ComfyExtension[],
    method: T,
    ...args: Parameters<ComfyExtensionParamsWithoutApp<T>>
  ): Promise<StartupHookFailure[]> => {
    const failures: StartupHookFailure[] = []
    for (const extension of extensions) {
      if (!extensionStore.isExtensionEnabled(extension.name)) continue
      try {
        const fn: unknown = extension[method]
        if (typeof fn !== 'function') continue
        if (method === 'setup')
          legacyMenuCompat.setCurrentExtension(extension.name)
        await fn.call(
          extension,
          ...args,
          method === 'setup'
            ? createSetupHookApp(useApp(), extension.name)
            : useApp()
        )
      } catch (error) {
        failures.push({ extension, method, error })
      } finally {
        if (method === 'setup') legacyMenuCompat.setCurrentExtension(null)
      }
    }
    return failures
  }

  return {
    registerExtension,
    registerExtensionNow,
    invokeExtensions,
    invokeExtensionsAsync,
    invokeStartupHook
  }
}

provideExtensionService(useExtensionService)
