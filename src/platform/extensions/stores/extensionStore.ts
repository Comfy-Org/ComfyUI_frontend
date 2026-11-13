import { defineStore } from 'pinia'
import { computed, markRaw, ref, shallowRef } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import type { SettingWriteOutcome } from '@comfyorg/settings-core/settingStore'
import { reportError } from '@comfyorg/telemetry/reportError'
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

function withReadOnlyExtensions(disabledNames: readonly string[]) {
  const disabled = new Set(disabledNames)
  for (const name of ALWAYS_DISABLED_EXTENSIONS) disabled.add(name)
  for (const name of ALWAYS_ENABLED_EXTENSIONS) disabled.delete(name)
  return disabled
}

function reportUnsavedSetting(
  result: SettingWriteOutcome,
  subject: string,
  errorType: string
) {
  switch (result.status) {
    case 'refused':
    case 'indeterminate':
      reportError(
        new Error(
          `Failed to store ${subject}: ${result.statusCode} ${result.statusText || 'Request failed'}`
        ),
        { errorType, surface: 'platform' }
      )
      break
    case 'unconfirmed':
      reportError(result.cause, { errorType, surface: 'platform' })
  }
}

type Registration =
  | { mode: 'immediate' }
  | { mode: 'holding'; held: readonly ComfyExtension[] }
  | { mode: 'starting' }

interface ExtensionPathState {
  paths: string[]
  disabledAtBoot: Set<string>
}

export const useExtensionStore = defineStore('extension', () => {
  // For legacy reasons, the name uniquely identifies an extension
  const extensionByName = ref<Record<string, ComfyExtension>>({})
  const extensions = computed(() => Object.values(extensionByName.value))
  // Not using computed because disable extension requires reloading of the page.
  // Dynamically update this list won't affect extensions that are already loaded.
  const disabledExtensionNames = ref<Set<string>>(new Set())
  const extensionPathState = shallowRef<ExtensionPathState>({
    paths: [],
    disabledAtBoot: new Set()
  })
  const extensionPaths = computed(() => extensionPathState.value.paths)
  const isSavingExtensionPaths = ref(false)

  const isAgentCreatedExtension = (extension: ComfyExtension) =>
    extension.provenance?.createdBy === 'comfy-agent' ||
    /^agent\.[^.]+\./.test(extension.name)
  const agentExtensions = computed(() =>
    extensions.value.filter(isAgentCreatedExtension)
  )
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
  const isHoldingCustomNodes = computed(
    () => registration.value.mode === 'holding'
  )
  const areLateCustomNodesPending = computed(
    () => registration.value.mode !== 'immediate'
  )

  /** From now on the extension service holds new extensions instead of registering them. */
  function holdNewCustomNodes() {
    if (registration.value.mode === 'immediate')
      registration.value = { mode: 'holding', held: [] }
  }

  function holdCustomNode(extension: ComfyExtension) {
    const current = registration.value
    if (current.mode === 'holding')
      registration.value = {
        mode: 'holding',
        held: [...current.held, extension]
      }
  }

  function releaseHeldCustomNode(extension: ComfyExtension) {
    const current = registration.value
    if (current.mode === 'holding')
      registration.value = {
        mode: 'holding',
        held: current.held.filter((held) => held !== extension)
      }
  }

  /** Returns the extensions held so far, in registration order; holding goes on. */
  function takeHeldCustomNodes(): ComfyExtension[] {
    const current = registration.value
    if (current.mode !== 'holding') return []
    registration.value = { mode: 'holding', held: [] }
    return [...current.held]
  }

  /** Ends holding and returns the extensions still held; they stay pending until `finishLateCustomNodes`. */
  function stopHoldingCustomNodes(): ComfyExtension[] {
    const current = registration.value
    if (current.mode !== 'holding') return []
    registration.value = { mode: 'starting' }
    return [...current.held]
  }

  function finishLateCustomNodes() {
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
    disabledExtensionNames.value = withReadOnlyExtensions(names)
  }

  const enabledByName = computed<Record<string, boolean>>(() => {
    const disabled = withReadOnlyExtensions(
      useSettingStore().get('Comfy.Extension.Disabled')
    )
    return Object.fromEntries(
      extensions.value.map((ext) => [ext.name, !disabled.has(ext.name)])
    )
  })

  const changedExtensions = computed(() =>
    extensions.value.filter(
      (ext) => enabledByName.value[ext.name] !== isExtensionEnabled(ext.name)
    )
  )

  async function setExtensionsEnabled(
    names: readonly string[],
    enabled: boolean
  ) {
    const settingStore = useSettingStore()
    const editable = new Set(names.filter((name) => !isExtensionReadOnly(name)))
    const disabled = settingStore.get('Comfy.Extension.Disabled')
    const result = await settingStore.setWithOutcome(
      'Comfy.Extension.Disabled',
      enabled
        ? disabled.filter((name) => !editable.has(name))
        : [...new Set([...disabled, ...editable])]
    )
    reportUnsavedSetting(
      result,
      'disabled extension names',
      'failure_saving_extension_name_setting'
    )
    return result.status
  }

  function loadExtensionPaths(paths: string[], disabledAtBoot: string[]) {
    extensionPathState.value = {
      paths: [...new Set(paths)],
      disabledAtBoot: new Set(disabledAtBoot)
    }
  }

  function isExtensionPathEnabledAtBoot(path: string) {
    return !extensionPathState.value.disabledAtBoot.has(path)
  }

  function getCurrentDisabledExtensionPaths(): string[] {
    return useSettingStore().get('Comfy.Extension.DisabledPacks')
  }

  const enabledByPath = computed<Record<string, boolean>>(() => {
    const disabled = new Set(getCurrentDisabledExtensionPaths())
    return Object.fromEntries(
      extensionPaths.value.map((path) => [path, !disabled.has(path)])
    )
  })

  const changedExtensionPaths = computed(() =>
    extensionPaths.value.filter(
      (path) => enabledByPath.value[path] !== isExtensionPathEnabledAtBoot(path)
    )
  )

  const hasPendingExtensionChanges = computed(
    () =>
      changedExtensions.value.length > 0 ||
      changedExtensionPaths.value.length > 0
  )

  async function setExtensionPathEnabled(
    path: string,
    enabled: boolean
  ): Promise<SettingWriteOutcome['status'] | undefined> {
    if (isSavingExtensionPaths.value) return

    const previousDisabledPaths = getCurrentDisabledExtensionPaths()
    const nextDisabledPaths = enabled
      ? previousDisabledPaths.filter((disabledPath) => disabledPath !== path)
      : [...new Set([...previousDisabledPaths, path])]
    isSavingExtensionPaths.value = true

    try {
      const result = await useSettingStore().setWithOutcome(
        'Comfy.Extension.DisabledPacks',
        nextDisabledPaths
      )
      reportUnsavedSetting(
        result,
        'disabled extension paths',
        'failure_saving_extension_path_setting'
      )
      return result.status
    } finally {
      isSavingExtensionPaths.value = false
    }
  }

  const coreExtensions = ref(new Set<ComfyExtension>())
  const coreExtensionsCaptured = ref(false)
  function markCoreExtensions(extensions: readonly ComfyExtension[]) {
    for (const extension of extensions) coreExtensions.value.add(extension)
  }

  function captureCoreExtensions() {
    markCoreExtensions(extensions.value)
    coreExtensionsCaptured.value = true
  }

  function isCoreExtension(name: string) {
    return (
      isExtensionInstalled(name) &&
      coreExtensions.value.has(extensionByName.value[name])
    )
  }

  /** Whether a registered extension's commands, keybindings and UI contributions apply. */
  function contributes(name: string) {
    if (!coreExtensionsCaptured.value || isCoreExtension(name)) return true
    return isExtensionEnabled(name)
  }

  const thirdPartyExtensions = computed(() =>
    extensions.value.filter((ext) => !isCoreExtension(ext.name))
  )
  const hasThirdPartyExtensions = computed(
    () => thirdPartyExtensions.value.length > 0
  )
  const hasEditableAgentExtensions = computed(() =>
    agentExtensions.value.some((ext) => !isExtensionReadOnly(ext.name))
  )

  return {
    extensions,
    agentExtensions,
    enabledExtensions,
    extensionPaths,
    isSavingExtensionPaths,
    isExtensionInstalled,
    isAgentCreatedExtension,
    isExtensionEnabled,
    isExtensionReadOnly,
    registerExtension,
    unregisterExtension,
    isHoldingCustomNodes,
    areLateCustomNodesPending,
    holdNewCustomNodes,
    holdCustomNode,
    releaseHeldCustomNode,
    takeHeldCustomNodes,
    stopHoldingCustomNodes,
    finishLateCustomNodes,
    oweNodeDefHooks,
    areNodeDefHooksOwed,
    takeOwedNodeDefHooks,
    loadDisabledExtensionNames,
    enabledByName,
    changedExtensions,
    setExtensionsEnabled,
    loadExtensionPaths,
    isExtensionPathEnabledAtBoot,
    getCurrentDisabledExtensionPaths,
    enabledByPath,
    changedExtensionPaths,
    hasPendingExtensionChanges,
    setExtensionPathEnabled,
    markCoreExtensions,
    captureCoreExtensions,
    contributes,
    isCoreExtension,
    thirdPartyExtensions,
    hasThirdPartyExtensions,
    hasEditableAgentExtensions
  }
})
