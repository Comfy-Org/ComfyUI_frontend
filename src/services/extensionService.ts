import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { legacyMenuCompat } from '@/lib/litegraph/src/contextMenuCompat'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { useCommandStore } from '@/stores/commandStore'
import { useExtensionStore } from '@/stores/extensionStore'
import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useMenuItemStore } from '@/stores/menuItemStore'
import { useWidgetStore } from '@/stores/widgetStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import type { ComfyExtension } from '@/types/comfy'
import type { AuthUserInfo } from '@/types/authTypes'
import { app } from '@/scripts/app'
import type { ComfyApp } from '@/scripts/app'

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
   * Loads all extensions from the API into the window in parallel
   */
  const loadExtensions = async () => {
    extensionStore.loadDisabledExtensionNames(
      settingStore.get('Comfy.Extension.Disabled')
    )

    const extensions = await api.getExtensions()

    // Need to load core extensions first as some custom extensions
    // may depend on them.
    await import('../extensions/core/index')
    extensionStore.captureCoreExtensions()
    await Promise.all(
      extensions
        .filter((extension) => !extension.includes('extensions/core'))
        .map(async (ext) => {
          try {
            await import(/* @vite-ignore */ api.fileURL(ext))
          } catch (error) {
            console.error('Error loading extension', ext, error)
          }
        })
    )
  }

  /**
   * Register an extension with the app
   * @param extension The extension to register
   */
  const registerExtension = (extension: ComfyExtension) => {
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
      // TODO(huchenlei): We should deprecate the async return value of
      // getCustomWidgets.
      void (async () => {
        if (extension.getCustomWidgets) {
          const widgets = await extension.getCustomWidgets(app)
          useWidgetStore().registerCustomWidgets(widgets)
        }
      })()
    }

    function registerAuthHook<T extends unknown[]>(
      hookName: string,
      hookFn: ((...args: T) => unknown) | undefined,
      subscribe: (cb: (...args: T) => void) => void
    ) {
      if (!hookFn) return
      const handler = wrapWithErrorHandlingAsync(
        (...args: T) => hookFn(...args),
        (error) => {
          console.error('[Extension Auth Hook Error]', {
            extension: extension.name,
            hook: hookName,
            error
          })
          toastErrorHandler(error)
        }
      )
      subscribe((...args: T) => {
        void handler(...args)
      })
    }

    const { onUserResolved, onTokenRefreshed, onUserLogout } = useCurrentUser()

    registerAuthHook(
      'onAuthUserResolved',
      extension.onAuthUserResolved
        ? (user: AuthUserInfo) => extension.onAuthUserResolved!(user, app)
        : undefined,
      onUserResolved
    )
    registerAuthHook(
      'onAuthTokenRefreshed',
      extension.onAuthTokenRefreshed
        ? () => extension.onAuthTokenRefreshed!()
        : undefined,
      onTokenRefreshed
    )
    registerAuthHook(
      'onAuthUserLogout',
      extension.onAuthUserLogout
        ? () => extension.onAuthUserLogout!()
        : undefined,
      onUserLogout
    )
  }

  type RemoveLastAppParam<T> = T extends (
    ...args: [...infer Rest, ComfyApp]
  ) => infer R
    ? (...args: Rest) => R
    : T

  type KnownExtensionMethods = Exclude<keyof ComfyExtension, number | symbol> &
    string

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
            results.push(fn.call(ext, ...args, app))
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
   * Each callback will be invoked concurrently
   * @param {string} method The extension callback to execute
   * @param  {...unknown} args Any arguments to pass to the callback
   * @returns
   */
  const invokeExtensionsAsync = async <T extends KnownExtensionMethods>(
    method: T,
    ...args: Parameters<ComfyExtensionParamsWithoutApp<T>>
  ) => {
    return await Promise.all(
      extensionStore.enabledExtensions.map(async (ext) => {
        if (method in ext) {
          try {
            const fn = ext[method]
            if (typeof fn !== 'function') {
              return
            }

            // Set current extension name for legacy compatibility tracking
            if (method === 'setup') {
              legacyMenuCompat.setCurrentExtension(ext.name)
            }

            const result = await fn.call(ext, ...args, app)

            // Clear current extension after setup
            if (method === 'setup') {
              legacyMenuCompat.setCurrentExtension(null)
            }

            return result
          } catch (error) {
            // Clear current extension on error too
            if (method === 'setup') {
              legacyMenuCompat.setCurrentExtension(null)
            }

            console.error(
              `Error calling extension '${ext.name}' method '${method}'`,
              { error },
              { extension: ext },
              { args }
            )
          }
        }
      })
    )
  }

  return {
    loadExtensions,
    registerExtension,
    invokeExtensions,
    invokeExtensionsAsync
  }
}
