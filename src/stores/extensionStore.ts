import { defineStore } from 'pinia'
import { computed, markRaw, ref, shallowRef } from 'vue'

import type { ComfyExtension } from '@/types/comfy'

/**
 * These extensions are always active, even if they are disabled in the setting.
 */
const ALWAYS_ENABLED_EXTENSIONS: readonly string[] = []

const ALWAYS_DISABLED_EXTENSIONS: readonly string[] = [
  // pysssss.Locking is replaced by pin/unpin in ComfyUI core.
  // https://github.com/Comfy-Org/litegraph.js/pull/117
  'pysssss.Locking',
  // pysssss.SnapToGrid is replaced by Comfy.Graph.AlwaysSnapToGrid in ComfyUI core.
  // pysssss.SnapToGrid tries to write global app.shiftDown state, which is no longer
  // allowed since v1.3.12.
  // https://github.com/Comfy-Org/ComfyUI_frontend/issues/1176
  'pysssss.SnapToGrid',
  // Favicon status is implemented in ComfyUI core in v1.20.
  // https://github.com/Comfy-Org/ComfyUI_frontend/pull/3880
  'pysssss.FaviconStatus',
  'KJNodes.browserstatus'
]

type Registration =
  | { mode: 'immediate' }
  | { mode: 'holding'; held: readonly ComfyExtension[] }
  | { mode: 'starting' }

export const useExtensionStore = defineStore('extension', () => {
  // For legacy reasons, the name uniquely identifies an extension
  const extensionByName = ref<Record<string, ComfyExtension>>({})
  const extensions = computed(() => Object.values(extensionByName.value))
  // Not using computed because disable extension requires reloading of the page.
  // Dynamically update this list won't affect extensions that are already loaded.
  const disabledExtensionNames = ref<Set<string>>(new Set())

  // Disabled extension names that are currently not in the extension list.
  // If a node pack is disabled in the backend, we shouldn't remove the configuration
  // of the frontend extension disable list, in case the node pack is re-enabled.
  const inactiveDisabledExtensionNames = computed(() => {
    return Array.from(disabledExtensionNames.value).filter(
      (name) => !(name in extensionByName.value)
    )
  })

  const isExtensionInstalled = (name: string) => name in extensionByName.value

  const isExtensionEnabled = (name: string) =>
    !disabledExtensionNames.value.has(name)
  const enabledExtensions = computed(() => {
    return extensions.value.filter((ext) => isExtensionEnabled(ext.name))
  })

  function isExtensionReadOnly(name: string) {
    return (
      ALWAYS_DISABLED_EXTENSIONS.includes(name) ||
      ALWAYS_ENABLED_EXTENSIONS.includes(name)
    )
  }

  function registerExtension(extension: ComfyExtension) {
    if (!extension.name) {
      throw new Error("Extensions must have a 'name' property.")
    }

    if (extension.name in extensionByName.value) {
      throw new Error(`Extension named '${extension.name}' already registered.`)
    }

    if (disabledExtensionNames.value.has(extension.name)) {
      console.warn(`Extension ${extension.name} is disabled.`)
    }

    extensionByName.value[extension.name] = markRaw(extension)
  }

  const registration = shallowRef<Registration>({ mode: 'immediate' })
  const isHoldingExtensions = computed(
    () => registration.value.mode === 'holding'
  )
  const areLateExtensionsPending = computed(
    () => registration.value.mode !== 'immediate'
  )

  /** From now on the extension service holds new extensions instead of registering them. */
  function holdNewExtensions() {
    if (registration.value.mode === 'immediate')
      registration.value = { mode: 'holding', held: [] }
  }

  function holdExtension(extension: ComfyExtension) {
    const current = registration.value
    if (current.mode === 'holding')
      registration.value = {
        mode: 'holding',
        held: [...current.held, extension]
      }
  }

  function releaseHeldExtension(extension: ComfyExtension) {
    const current = registration.value
    if (current.mode === 'holding')
      registration.value = {
        mode: 'holding',
        held: current.held.filter((held) => held !== extension)
      }
  }

  /** Returns the extensions held so far, in registration order; holding goes on. */
  function takeHeldExtensions(): ComfyExtension[] {
    const current = registration.value
    if (current.mode !== 'holding') return []
    registration.value = { mode: 'holding', held: [] }
    return [...current.held]
  }

  /** Ends holding and returns the extensions still held; they stay pending until `finishLateExtensions`. */
  function stopHoldingExtensions(): ComfyExtension[] {
    const current = registration.value
    if (current.mode !== 'holding') return []
    registration.value = { mode: 'starting' }
    return [...current.held]
  }

  function finishLateExtensions() {
    registration.value = { mode: 'immediate' }
  }

  const nodeDefHooksOwed = ref(false)

  /** The next node definitions fetched go through every extension's `addCustomNodeDefs` before they register. */
  function oweNodeDefHooks() {
    nodeDefHooksOwed.value = true
  }

  /** Whether the next node definitions fetched are owed to `addCustomNodeDefs`, without settling the debt. */
  function areNodeDefHooksOwed(): boolean {
    return nodeDefHooksOwed.value
  }

  /** Whether fetched node definitions are owed to `addCustomNodeDefs`; settles the debt. */
  function takeOwedNodeDefHooks(): boolean {
    const owed = nodeDefHooksOwed.value
    nodeDefHooksOwed.value = false
    return owed
  }

  function unregisterExtension(name: string) {
    delete extensionByName.value[name]
  }

  function loadDisabledExtensionNames(names: string[]) {
    disabledExtensionNames.value = new Set(names)
    for (const name of ALWAYS_DISABLED_EXTENSIONS) {
      disabledExtensionNames.value.add(name)
    }
    for (const name of ALWAYS_ENABLED_EXTENSIONS) {
      disabledExtensionNames.value.delete(name)
    }
  }

  /**
   * Core extensions are extensions that are defined in the core package.
   * See /extensions/core/index.ts for the list.
   */
  const coreExtensionNames = ref<string[]>([])
  function captureCoreExtensions() {
    coreExtensionNames.value = extensions.value.map((ext) => ext.name)
  }

  function isCoreExtension(name: string) {
    return coreExtensionNames.value.includes(name)
  }

  const hasThirdPartyExtensions = computed(() => {
    return extensions.value.some((ext) => !isCoreExtension(ext.name))
  })

  return {
    extensions,
    enabledExtensions,
    inactiveDisabledExtensionNames,
    isExtensionInstalled,
    isExtensionEnabled,
    isExtensionReadOnly,
    registerExtension,
    unregisterExtension,
    isHoldingExtensions,
    areLateExtensionsPending,
    holdNewExtensions,
    holdExtension,
    releaseHeldExtension,
    takeHeldExtensions,
    stopHoldingExtensions,
    finishLateExtensions,
    oweNodeDefHooks,
    areNodeDefHooksOwed,
    takeOwedNodeDefHooks,
    loadDisabledExtensionNames,
    captureCoreExtensions,
    isCoreExtension,
    hasThirdPartyExtensions
  }
})
