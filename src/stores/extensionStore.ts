import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { ComfyExtension } from '@/types/comfy'
import { useKeybindingStore } from './keybindingStore'
import { useCommandStore } from './commandStore'
import { useSettingStore } from './settingStore'
import { app } from '@/scripts/app'

export const useExtensionStore = defineStore('extension', () => {
  // For legacy reasons, the name uniquely identifies an extension
  const extensionByName = ref<Record<string, ComfyExtension>>({})
  const extensions = computed(() => Object.values(extensionByName.value))
  // Not using computed because disable extension requires reloading of the page.
  // Dynamically update this list won't affect extensions that are already loaded.
  const disabledExtensionNames = ref<Set<string>>(new Set())
  const isExtensionEnabled = (name: string) =>
    !disabledExtensionNames.value.has(name)
  const enabledExtensions = computed(() => {
    return extensions.value.filter((ext) => isExtensionEnabled(ext.name))
  })

  function registerExtension(extension: ComfyExtension) {
    if (!extension.name) {
      throw new Error("Extensions must have a 'name' property.")
    }

    if (extensionByName.value[extension.name]) {
      throw new Error(`Extension named '${extension.name}' already registered.`)
    }

    if (disabledExtensionNames.value.has(extension.name)) {
      console.log(`Extension ${extension.name} is disabled.`)
      return
    }

    extensionByName.value[extension.name] = extension
    useKeybindingStore().loadExtensionKeybindings(extension)
    useCommandStore().loadExtensionCommands(extension)

    /*
     * Extensions are currently stored in both extensionStore and app.extensions.
     * Legacy jest tests still depend on app.extensions being populated.
     */
    app.extensions.push(extension)
  }

  function loadDisabledExtensionNames() {
    disabledExtensionNames.value = new Set(
      useSettingStore().get('Comfy.Extension.Disabled')
    )
  }

  return {
    extensions,
    enabledExtensions,
    isExtensionEnabled,
    registerExtension,
    loadDisabledExtensionNames
  }
})
