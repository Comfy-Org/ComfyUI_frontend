import { defineStore } from 'pinia'
import { computed, markRaw, ref, shallowRef } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import type { SettingWriteResult } from '@/platform/settings/types'
import type { ComfyExtension } from '@/types/comfy'

export function extensionPackName(path: string) {
  const name = path.split('/').filter(Boolean).at(-1) ?? path
  try {
    return decodeURIComponent(name)
  } catch {
    return name
  }
}

/** The pack an `agent.<pack>.<rest>` name claims, if it follows the convention. */
export function agentExtensionPackName(extensionName: string) {
  if (!extensionName.startsWith('agent.')) return undefined
  return extensionName.split('.')[1] || undefined
}

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
  const extensionByName = ref<Record<string, ComfyExtension>>({})
  const extensions = computed(() => Object.values(extensionByName.value))
  const isAgentCreatedExtension = (extension: ComfyExtension) =>
    extension.provenance?.createdBy === 'comfy-agent' ||
    extension.name.startsWith('agent.')
  const agentExtensions = computed(() =>
    extensions.value.filter(isAgentCreatedExtension)
  )
  const getAgentExtensionPackPath = (extension: ComfyExtension) => {
    const packName = agentExtensionPackName(extension.name)
    if (!packName) return undefined
    return extensionPackPaths.value.find(
      (path) => extensionPackName(path) === packName
    )
  }
  const extensionPackPaths = ref<string[]>([])
  const bootDisabledExtensionPackPaths = ref<Set<string>>(new Set())
  const bootDisabledExtensionNames = ref<Set<string>>(new Set())

  const isExtensionInstalled = (name: string) => name in extensionByName.value

  const isExtensionEnabled = (name: string) => {
    if (ALWAYS_ENABLED_EXTENSIONS.includes(name)) return true
    if (ALWAYS_DISABLED_EXTENSIONS.includes(name)) return false
    return !bootDisabledExtensionNames.value.has(name)
  }
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

    if (!isExtensionEnabled(extension.name)) {
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

  function loadBootDisabledExtensionNames(names: string[]) {
    bootDisabledExtensionNames.value = new Set(names)
  }

  const loadDisabledExtensionNames = loadBootDisabledExtensionNames

  function loadExtensionPackPaths(paths: string[], disabledPaths: string[]) {
    extensionPackPaths.value = [...new Set(paths)]
    bootDisabledExtensionPackPaths.value = new Set(disabledPaths)
  }

  const wasExtensionPackEnabledAtBoot = (path: string) =>
    !bootDisabledExtensionPackPaths.value.has(path)

  const disabledExtensionPackPaths = computed(
    () => new Set(useSettingStore().get('Comfy.Extension.DisabledPacks'))
  )

  const isExtensionPackEnabled = (path: string) =>
    !disabledExtensionPackPaths.value.has(path)

  const unacknowledgedPackSaves = ref(0)
  const isSavingExtensionPacks = computed(
    () => unacknowledgedPackSaves.value > 0
  )

  let packSaveChain: Promise<unknown> = Promise.resolve()

  async function queuePackSave(
    write: () => Promise<SettingWriteResult>
  ): Promise<SettingWriteResult> {
    const run = packSaveChain.then(write)
    packSaveChain = run.catch(() => {})
    unacknowledgedPackSaves.value++
    try {
      return await run
    } finally {
      unacknowledgedPackSaves.value--
    }
  }

  async function waitForExtensionSaves() {
    let pending: Promise<unknown>
    do {
      pending = packSaveChain
      await pending
    } while (pending !== packSaveChain)
  }

  /** Enable or disable a whole pack, serialized behind any save still in flight. */
  async function setExtensionPackEnabled(
    path: string,
    enabled: boolean
  ): Promise<SettingWriteResult> {
    const settingStore = useSettingStore()
    return queuePackSave(() => {
      const disabled = new Set(
        settingStore.get('Comfy.Extension.DisabledPacks')
      )
      if (enabled) disabled.delete(path)
      else disabled.add(path)
      return settingStore.setOrRevert('Comfy.Extension.DisabledPacks', [
        ...disabled
      ])
    })
  }

  function planAgentExtensionDisable(extensions: readonly ComfyExtension[]) {
    const settingStore = useSettingStore()
    const disabledNames = new Set(settingStore.get('Comfy.Extension.Disabled'))
    const disabledPackPaths = new Set(
      settingStore.get('Comfy.Extension.DisabledPacks')
    )

    for (const extension of extensions) {
      if (isExtensionReadOnly(extension.name)) continue
      const packPath = getAgentExtensionPackPath(extension)
      if (packPath) disabledPackPaths.add(packPath)
      else disabledNames.add(extension.name)
    }

    return {
      'Comfy.Extension.Disabled': [...disabledNames],
      'Comfy.Extension.DisabledPacks': [...disabledPackPaths]
    }
  }

  async function setExtensionEnabledStates(
    enabledByName: Readonly<Record<string, boolean>>
  ): Promise<SettingWriteResult> {
    const settingStore = useSettingStore()
    return queuePackSave(() => {
      const disabledNames = new Set(
        settingStore.get('Comfy.Extension.Disabled')
      )
      for (const [name, enabled] of Object.entries(enabledByName)) {
        if (isExtensionReadOnly(name)) continue
        if (enabled) disabledNames.delete(name)
        else disabledNames.add(name)
      }
      return settingStore.setOrRevert('Comfy.Extension.Disabled', [
        ...disabledNames
      ])
    })
  }

  async function disableAgentExtensions(
    extensions: readonly ComfyExtension[]
  ): Promise<SettingWriteResult> {
    const settingStore = useSettingStore()
    return queuePackSave(() =>
      settingStore.setManyOrRevert(planAgentExtensionDisable(extensions))
    )
  }

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
  const hasAgentExtensions = computed(() => agentExtensions.value.length > 0)

  return {
    extensions,
    agentExtensions,
    enabledExtensions,
    extensionPackPaths,
    isExtensionInstalled,
    isExtensionEnabled,
    isExtensionReadOnly,
    isAgentCreatedExtension,
    getAgentExtensionPackPath,
    registerExtension,
    unregisterExtension,
    loadBootDisabledExtensionNames,
    loadExtensionPackPaths,
    wasExtensionPackEnabledAtBoot,
    isExtensionPackEnabled,
    isSavingExtensionPacks,
    waitForExtensionSaves,
    setExtensionPackEnabled,
    setExtensionEnabledStates,
    disableAgentExtensions,
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
    hasThirdPartyExtensions,
    hasAgentExtensions
  }
})
