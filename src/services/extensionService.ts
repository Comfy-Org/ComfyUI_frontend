import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { legacyMenuCompat } from '@/lib/litegraph/src/contextMenuCompat'
import { isCloud, isNightly } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { useExtensionStore } from '@/stores/extensionStore'
import { KeybindingImpl, useKeybindingStore } from '@/stores/keybindingStore'
import { useMenuItemStore } from '@/stores/menuItemStore'
import { useWidgetStore } from '@/stores/widgetStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import type { ComfyExtension } from '@/types/comfy'
import type { AuthUserInfo } from '@/types/authTypes'

type ExtensionModule = { default?: ComfyExtension; extension?: ComfyExtension }

const coreExtensionModules = import.meta.glob<ExtensionModule>(
  '../extensions/core/*.ts',
  { eager: false }
)

async function loadCoreExtensions(
  registerExtension: (ext: ComfyExtension) => void
) {
  const loadPromises = Object.entries(coreExtensionModules)
    .filter(([path]) => !path.endsWith('/index.ts'))
    .map(async ([path, loader]) => {
      try {
        const mod = await loader()
        const extension = mod.default ?? mod.extension
        if (extension && typeof extension === 'object' && 'name' in extension) {
          registerExtension(extension)
        }
      } catch (e) {
        console.error(`Failed to load extension from ${path}:`, e)
      }
    })

  await Promise.all(loadPromises)

  if (isCloud) {
    try {
      await import('../extensions/core/cloudRemoteConfig')
    } catch (e) {
      console.error('Failed to load cloudRemoteConfig:', e)
    }

    try {
      await import('../extensions/core/cloudBadges')
    } catch (e) {
      console.error('Failed to load cloudBadges:', e)
    }

    try {
      await import('../extensions/core/cloudSessionCookie')
    } catch (e) {
      console.error('Failed to load cloudSessionCookie:', e)
    }

    if (window.__CONFIG__?.subscription_required) {
      try {
        await import('../extensions/core/cloudSubscription')
      } catch (e) {
        console.error('Failed to load cloudSubscription:', e)
      }
    }
  }

  if (isCloud || isNightly) {
    try {
      await import('../extensions/core/cloudFeedbackTopbarButton')
    } catch (e) {
      console.error('Failed to load cloudFeedbackTopbarButton:', e)
    }
  }

  if (isNightly && !isCloud) {
    try {
      await import('../extensions/core/nightlyBadges')
    } catch (e) {
      console.error('Failed to load nightlyBadges:', e)
    }
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

    await loadCoreExtensions(registerExtension)
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

  /**
   * Invoke an extension callback
   * @param {keyof ComfyExtension} method The extension callback to execute
   * @param  {any[]} args Any arguments to pass to the callback
   * @returns
   */
  const invokeExtensions = (method: keyof ComfyExtension, ...args: any[]) => {
    const results: any[] = []
    for (const ext of extensionStore.enabledExtensions) {
      if (method in ext) {
        try {
          results.push(ext[method](...args, app))
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
   * @param  {...any} args Any arguments to pass to the callback
   * @returns
   */
  const invokeExtensionsAsync = async (
    method: keyof ComfyExtension,
    ...args: any[]
  ) => {
    return await Promise.all(
      extensionStore.enabledExtensions.map(async (ext) => {
        if (method in ext) {
          try {
            // Set current extension name for legacy compatibility tracking
            if (method === 'setup') {
              legacyMenuCompat.setCurrentExtension(ext.name)
            }

            const result = await ext[method](...args, app)

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
