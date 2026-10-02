import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { legacyMenuCompat } from '@/lib/litegraph/src/contextMenuCompat'
import { useSettingStore } from '@/platform/settings/settingStore'
import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
import { reportError } from '@/platform/telemetry/reportError'
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

const INLINED_CLOUD_EXTENSIONS = new Set([
  '/extensions/cloud/rum.js',
  '/extensions/cloud/sentry.js'
])

export function shouldLoadExtension(
  extension: string,
  isCloudBuild: boolean
): boolean {
  if (extension.includes('extensions/core')) return false
  return !isCloudBuild || !INLINED_CLOUD_EXTENSIONS.has(extension)
}

/**
 * Import one backend-provided extension. A failure is reported and swallowed so
 * that one broken custom node cannot abort the rest of the parallel load.
 *
 * `reportError` writes the console line itself, so there is deliberately no
 * `console.error` here — pairing the two emits the same failure twice, once
 * untyped.
 *
 * Exported for the rejected-import test: `loadExtensions` also imports the
 * whole core extension entry point, which a unit test cannot pull in.
 */
export async function importCustomExtension(ext: string): Promise<void> {
  try {
    await import(/* @vite-ignore */ api.fileURL(ext))
  } catch (error) {
    reportError(error, {
      errorType: 'extension_load_failed',
      surface: 'platform',
      level: 'warning',
      tags: { extension: ext }
    })
  }
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
   * Loads all extensions from the API into the window in parallel
   */
  const loadExtensions = async () => {
    extensionStore.loadDisabledExtensionNames(
      settingStore.get('Comfy.Extension.Disabled')
    )

    const extensions = await api.getExtensions()

    // Need to load core extensions first as some custom extensions
    // may depend on them.
    await bootstrapTracer.settle(
      'bootstrap/extensions-load-core',
      () => import('../extensions/core/index')
    )
    extensionStore.captureCoreExtensions()
    await bootstrapTracer.settle('bootstrap/extensions-load-custom', () =>
      Promise.all(
        extensions
          .filter((extension) =>
            shouldLoadExtension(extension, __DISTRIBUTION__ === 'cloud')
          )
          .map((ext) => importCustomExtension(ext))
      )
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

    if (extension.onAuthUserResolved) {
      const { onUserResolved } = useCurrentUser()
      const handleUserResolved = wrapWithErrorHandlingAsync(
        (user: AuthUserInfo) => extension.onAuthUserResolved?.(user, app),
        (error) => {
          console.error('[Extension Auth Hook Error]', {
            extension: extension.name,
            hook: 'onAuthUserResolved',
            error
          })
          toastErrorHandler(error)
        }
      )
      onUserResolved((user) => {
        void handleUserResolved(user)
      })
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
      onTokenRefreshed(() => {
        void handleTokenRefreshed()
      })
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
      onUserLogout(() => {
        void handleUserLogout()
      })
    }
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
