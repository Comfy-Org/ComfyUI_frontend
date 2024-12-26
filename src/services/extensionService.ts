import { useCommandStore } from '@/stores/commandStore'
import { useExtensionStore } from '@/stores/extensionStore'
import { useKeybindingStore } from '@/stores/keybindingStore'
import { useMenuItemStore } from '@/stores/menuItemStore'
import { useSettingStore } from '@/stores/settingStore'
import { useWidgetStore } from '@/stores/widgetStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import type { ComfyExtension } from '@/types/comfy'

export const useExtensionService = () => {
  const extensionStore = useExtensionStore()

  const registerExtension = (extension: ComfyExtension) => {
    extensionStore.registerExtension(extension)

    useKeybindingStore().loadExtensionKeybindings(extension)
    useCommandStore().loadExtensionCommands(extension)
    useMenuItemStore().loadExtensionMenuCommands(extension)
    useSettingStore().loadExtensionSettings(extension)
    useBottomPanelStore().registerExtensionBottomPanelTabs(extension)
    if (extension.getCustomWidgets) {
      // TODO(huchenlei): We should deprecate the async return value of
      // getCustomWidgets.
      ;(async () => {
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
          results.push(ext[method](...args, this))
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
            return await ext[method](...args, this)
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

  return {
    registerExtension,
    invokeExtensions,
    invokeExtensionsAsync
  }
}
