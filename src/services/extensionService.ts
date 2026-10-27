import { once } from 'es-toolkit'
import type { WatchHandle } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { legacyMenuCompat } from '@/lib/litegraph/src/contextMenuCompat'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/stores/commandStore'
import { useExtensionStore } from '@/stores/extensionStore'
import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useMenuItemStore } from '@/stores/menuItemStore'
import { useWidgetStore } from '@/stores/widgetStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import type { ComfyApp, ComfyExtension } from '@/types/comfy'
import type { AuthUserInfo } from '@/types/authTypes'
import { useApp } from '@/scripts/appInstance'
import {
  createGraphLoadHookDispatch,
  duringGraphLoadHook
} from '@/scripts/graphLoadGuard'
import { provideExtensionService } from '@/services/extensionServiceAccess'

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
    if (extensionStore.isHoldingExtensions) {
      extensionStore.holdExtension(extension)
      return once(() => extensionStore.releaseHeldExtension(extension))
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
    const invokeAll = () => {
      const app = graphLoadDispatch?.hookApp ?? useApp()
      const logError = (ext: ComfyExtension, error: unknown) =>
        console.error(
          `Error calling extension '${ext.name}' method '${method}'`,
          { error },
          { extension: ext },
          { args }
        )

      const pending: unknown[] = []
      for (const ext of extensionStore.enabledExtensions) {
        try {
          const fn = ext[method]
          if (typeof fn !== 'function') continue

          if (method === 'setup') {
            pending.push(
              (async () => {
                legacyMenuCompat.setCurrentExtension(ext.name)
                try {
                  return await fn.call(ext, ...args, app)
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
      return pending
    }
    const pending = graphLoadDispatch
      ? duringGraphLoadHook(invokeAll)
      : invokeAll()
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
        await fn.call(extension, ...args, useApp())
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
