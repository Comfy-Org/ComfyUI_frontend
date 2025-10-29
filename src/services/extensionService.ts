import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { legacyMenuCompat } from '@/lib/litegraph/src/contextMenuCompat'
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

export const useExtensionService = () => {
  const extensionStore = useExtensionStore()
  const settingStore = useSettingStore()
  const keybindingStore = useKeybindingStore()
  const { wrapWithErrorHandling } = useErrorHandling()

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

    if (extension.onAuthUserResolved) {
      const { onUserResolved } = useCurrentUser()
      onUserResolved((user) => {
        void extension.onAuthUserResolved?.(user, app)
      })
    }

    if (extension.onAuthTokenRefreshed) {
      const { onTokenRefreshed } = useCurrentUser()
      onTokenRefreshed(() => {
        void extension.onAuthTokenRefreshed?.()
      })
    }

    if (extension.onAuthUserLogout) {
      const { onUserLogout } = useCurrentUser()
      onUserLogout(() => {
        void extension.onAuthUserLogout?.()
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
