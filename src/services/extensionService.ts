import { useErrorHandling } from '@/composables/useErrorHandling'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { useExtensionStore } from '@/stores/extensionStore'
import { KeybindingImpl, useKeybindingStore } from '@/stores/keybindingStore'
import { useMenuItemStore } from '@/stores/menuItemStore'
import { useSettingStore } from '@/stores/settingStore'
import { useWidgetStore } from '@/stores/widgetStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import type { ComfyExtension } from '@/types/comfy'
import { VersionProxies } from '@/utils/versionProxies'

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
            return await ext[method](...args, app)
          } catch (error) {
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

  /**
   * Register extension with API version tracking
   */
  const registerExtensionWithVersion = (
    extension: ComfyExtension,
    apiVersion: string = 'latest'
  ) => {
    extension.apiVersion = apiVersion
    registerExtension(extension)
  }

  /**
   * Invoke extensions for a specific API version with transformed args
   */
  const invokeExtensionsForVersion = async <T extends any[]>(
    hook: keyof ComfyExtension,
    apiVersion: string,
    ...args: T
  ) => {
    const extensions = extensionStore.extensions.filter(
      (ext) =>
        ext.apiVersion === apiVersion ||
        (!ext.apiVersion && apiVersion === 'latest')
    )

    for (const extension of extensions) {
      if (extension[hook] && typeof extension[hook] === 'function') {
        try {
          const transformedArgs = transformArgsForVersion(apiVersion, args)
          await (extension[hook] as (...args: T) => void | Promise<void>)(
            ...transformedArgs
          )
        } catch (error) {
          console.error(
            `Error in extension ${extension.name} hook ${String(hook)}:`,
            error
          )
        }
      }
    }
  }

  /**
   * Invoke extensions for all API versions with appropriate data transformation
   */
  const invokeExtensionsForAllVersions = async <T extends any[]>(
    hook: keyof ComfyExtension,
    ...args: T
  ) => {
    const apiVersions = new Set(['latest', 'v1', 'v1_2', 'v3'])
    const promises = []

    for (const version of apiVersions) {
      promises.push(invokeExtensionsForVersion(hook, version, ...args))
    }

    await Promise.all(promises)
  }

  /**
   * Transform arguments for specific API version
   */
  const transformArgsForVersion = (version: string, args: any[]) => {
    return args.map((arg) => {
      // If argument looks like a node definition, create appropriate proxy
      if (
        arg &&
        typeof arg === 'object' &&
        arg.name &&
        typeof arg.name === 'string'
      ) {
        try {
          switch (version) {
            case 'v1':
              return VersionProxies.createV1Proxy(arg.name)
            case 'v1_2':
              return VersionProxies.createV1_2Proxy(arg.name)
            case 'v3':
              return VersionProxies.createV3Proxy(arg.name)
            default:
              return arg
          }
        } catch (error) {
          // If proxy creation fails, return original arg
          console.warn(`Failed to create proxy for node ${arg.name}:`, error)
          return arg
        }
      }
      return arg
    })
  }

  /**
   * Get extension compatibility report by API version
   */
  const getExtensionVersionReport = () => {
    const extensions = extensionStore.extensions
    const versionGroups = extensions.reduce(
      (acc, ext) => {
        const version = ext.apiVersion || 'latest'
        if (!acc[version]) acc[version] = []
        acc[version].push(ext)
        return acc
      },
      {} as Record<string, ComfyExtension[]>
    )

    return {
      total: extensions.length,
      versionGroups,
      details: Object.entries(versionGroups).map(([version, exts]) => ({
        version,
        count: exts.length,
        extensions: exts.map((ext) => ext.name)
      }))
    }
  }

  return {
    loadExtensions,
    registerExtension,
    registerExtensionWithVersion,
    invokeExtensions,
    invokeExtensionsAsync,
    invokeExtensionsForVersion,
    invokeExtensionsForAllVersions,
    getExtensionVersionReport
  }
}
