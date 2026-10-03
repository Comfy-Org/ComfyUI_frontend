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
import { getErrorMessage } from '@/utils/errorUtil'
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

/** Paths named in a batch report before the rest are elided to a count. */
const MAX_NAMED_FAILED_EXTENSIONS = 10

export interface ExtensionLoadFailure {
  ext: string
  error: unknown
}

/**
 * Import one backend-provided extension, returning the failure rather than
 * throwing, so one broken pack cannot abort the rest of the parallel load.
 *
 * Reporting deliberately does not happen here. A systemic failure — a backend
 * restart, or a proxy serving HTML for every `.js` — fails every import in the
 * list, and one report per extension is then unbounded. Off cloud that is
 * actively harmful: with no sink live, each report is held in `reportError`'s
 * 25-entry pending buffer, so a handful of broken packs during bootstrap would
 * silently crowd out every later error in the session. The batch is reported
 * once, by `reportExtensionLoadFailures`.
 */
async function importCustomExtension(
  ext: string
): Promise<ExtensionLoadFailure | undefined> {
  try {
    await import(/* @vite-ignore */ api.fileURL(ext))
  } catch (error) {
    return { ext, error }
  }
}

/**
 * The paths go in the message because `reportError` writes its console line
 * from the error, not from `options.tags`. The count is tagged; backend paths
 * are unbounded and belong in context instead of an indexed facet.
 */
export function reportExtensionLoadFailures(
  failures: ExtensionLoadFailure[]
): void {
  if (failures.length === 0) return

  const named = failures.slice(0, MAX_NAMED_FAILED_EXTENSIONS)
  const elided = failures.length - named.length
  const paths = named.map(({ ext }) => ext).join(', ')

  reportError(
    new Error(
      `Error loading ${failures.length} ${failures.length === 1 ? 'extension' : 'extensions'}: ${paths}` +
        (elided > 0 ? ` (+${elided} more)` : ''),
      { cause: failures[0].error }
    ),
    {
      errorType: 'error_loading_extension',
      surface: 'platform',
      level: 'warning',
      tags: { failed_extension_count: failures.length },
      context: {
        failures: named.map(({ ext, error }) => ({
          ext,
          message: getErrorMessage(error)
        }))
      }
    }
  )
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
    const outcomes = await bootstrapTracer.settle(
      'bootstrap/extensions-load-custom',
      () =>
        Promise.all(
          extensions
            .filter((extension) =>
              shouldLoadExtension(extension, __DISTRIBUTION__ === 'cloud')
            )
            .map((ext) => importCustomExtension(ext))
        )
    )
    reportExtensionLoadFailures(outcomes.filter((outcome) => !!outcome))
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