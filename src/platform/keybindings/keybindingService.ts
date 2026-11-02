import { useEventListener } from '@vueuse/core'

import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import { isModalOpen } from '@/utils/modalUtil'

import { CORE_KEYBINDINGS } from './defaults'
import { consultEscapeOverride } from './escapeOverride'
import { KeyComboImpl } from '@comfyorg/keybindings/keyCombo'
import { KeybindingImpl } from '@comfyorg/keybindings/keybinding'
import { useKeybindingStore } from '@comfyorg/keybindings/keybindingStore'

function isExcludedFromDistribution(keybinding: { commandId: string }) {
  return (
    isCloud &&
    keybinding.commandId === 'Workspace.ToggleBottomPanelTab.logs-terminal'
  )
}

type KeydownResolution =
  | { kind: 'unclaimed' }
  | { kind: 'blockedByModal'; suppressBrowserDefault: boolean }
  | { kind: 'legacyEscape' }
  | { kind: 'claimed'; keybinding: KeybindingImpl }

const UNCLAIMED: KeydownResolution = { kind: 'unclaimed' }
const LEGACY_ESCAPE: KeydownResolution = { kind: 'legacyEscape' }

const CANVAS_CONTAINER_ID = 'graph-canvas-container'

const RUN_COMMAND_IDS = new Set([
  'Comfy.QueuePrompt',
  'Comfy.QueuePromptFront',
  'Comfy.QueueSelectedOutputNodes'
])

const resolutions = new WeakMap<KeyboardEvent, KeydownResolution>()

function isTextEditingTarget(target: EventTarget | undefined): boolean {
  if (!(target instanceof Element)) return false
  if (target instanceof HTMLElement && target.isContentEditable) return true
  return (
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'INPUT' ||
    (target.tagName === 'SPAN' && target.classList.contains('property_value'))
  )
}

function isEscapeOwnedByMenuOrDialog(
  event: KeyboardEvent,
  target: EventTarget | undefined
): boolean {
  return (
    event.key === 'Escape' &&
    target instanceof Element &&
    target.closest('[role="menu"], [role="menubar"], [role="dialog"]') !== null
  )
}

function isLeftToTarget(
  event: KeyboardEvent,
  keyCombo: KeyComboImpl,
  target: EventTarget | undefined
): boolean {
  return (
    keyCombo.isModifier ||
    event.isComposing ||
    isEscapeOwnedByMenuOrDialog(event, target) ||
    (keyCombo.isReservedByTextInput && isTextEditingTarget(target))
  )
}

function isWithinTargetElement(
  keybinding: KeybindingImpl,
  target: EventTarget | undefined
): boolean {
  const targetElementId =
    keybinding.targetElementId === 'graph-canvas'
      ? CANVAS_CONTAINER_ID
      : keybinding.targetElementId
  if (!targetElementId) return true
  const container = document.getElementById(targetElementId)
  return target instanceof Node && container?.contains(target) === true
}

function isUnmodifiedEscape(event: KeyboardEvent): boolean {
  return (
    event.key === 'Escape' && !event.ctrlKey && !event.altKey && !event.metaKey
  )
}

function closeLegacyModals() {
  for (const modal of document.querySelectorAll<HTMLElement>('.comfy-modal')) {
    const display = window.getComputedStyle(modal).getPropertyValue('display')
    if (display !== 'none') {
      modal.style.display = 'none'
      break
    }
  }
  for (const dialog of document.querySelectorAll('dialog')) dialog.close()
}

export function useKeybindingService() {
  const keybindingStore = useKeybindingStore()
  const commandStore = useCommandStore()
  const settingStore = useSettingStore()
  const dialogStore = useDialogStore()

  function getExecutableKeybinding(keyCombo: KeyComboImpl) {
    const keybinding = keybindingStore.getKeybinding(keyCombo)
    return keybinding && commandStore.isRegistered(keybinding.commandId)
      ? keybinding
      : undefined
  }

  function resolve(event: KeyboardEvent): KeydownResolution {
    const keyCombo = KeyComboImpl.fromEvent(event)
    const target = event.composedPath()[0]
    if (isLeftToTarget(event, keyCombo, target)) return UNCLAIMED

    const keybinding = getExecutableKeybinding(keyCombo)
    if (!keybinding)
      return isUnmodifiedEscape(event) ? LEGACY_ESCAPE : UNCLAIMED
    if (!isWithinTargetElement(keybinding, target)) return UNCLAIMED
    if (isModalOpen(dialogStore.dialogStack.length)) {
      return { kind: 'blockedByModal', suppressBrowserDefault: keyCombo.ctrl }
    }
    return { kind: 'claimed', keybinding }
  }

  function resolutionOf(event: KeyboardEvent): KeydownResolution {
    const resolved = resolutions.get(event)
    if (resolved) return resolved
    const resolution = resolve(event)
    resolutions.set(event, resolution)
    return resolution
  }

  function resolveKeydown(event: KeyboardEvent) {
    resolutions.set(event, resolve(event))
  }

  function executeCanvasKeybinding(event: KeyboardEvent): boolean {
    if (event.type !== 'keydown' || event.repeat) return false

    const resolution = resolutionOf(event)
    if (
      resolution.kind !== 'claimed' ||
      resolution.keybinding.targetElementId !== CANVAS_CONTAINER_ID
    ) {
      return false
    }

    void commandStore.execute(resolution.keybinding.commandId)
    event.preventDefault()
    event.stopImmediatePropagation()
    return true
  }

  async function executeKeybinding(keybinding: KeybindingImpl) {
    if (RUN_COMMAND_IDS.has(keybinding.commandId)) {
      await commandStore.execute(keybinding.commandId, {
        metadata: { trigger_source: 'keybinding' }
      })
      return
    }
    await commandStore.execute(keybinding.commandId)
  }

  async function commitAtWindow(
    keybinding: KeybindingImpl,
    event: KeyboardEvent
  ) {
    if (event.key === 'Escape' && consultEscapeOverride(event)) {
      if (!event.defaultPrevented) event.preventDefault()
      return
    }
    event.preventDefault()
    await executeKeybinding(keybinding)
  }

  async function keybindHandler(event: KeyboardEvent) {
    const resolution = resolutionOf(event)
    switch (resolution.kind) {
      case 'unclaimed':
        return
      case 'blockedByModal':
        if (resolution.suppressBrowserDefault) event.preventDefault()
        return
      case 'legacyEscape':
        closeLegacyModals()
        return
      case 'claimed':
        await commitAtWindow(resolution.keybinding, event)
    }
  }

  function listenForKeydowns() {
    useEventListener(window, 'keydown', resolveKeydown, { capture: true })
    useEventListener(window, 'keydown', keybindHandler)
  }

  function registerCoreKeybindings() {
    for (const keybinding of CORE_KEYBINDINGS) {
      if (isExcludedFromDistribution(keybinding)) continue
      keybindingStore.addDefaultKeybinding(new KeybindingImpl(keybinding))
    }
  }

  function registerUserKeybindings() {
    const unsetBindings = settingStore.get('Comfy.Keybinding.UnsetBindings')
    for (const keybinding of unsetBindings) {
      if (isExcludedFromDistribution(keybinding)) continue
      keybindingStore.addUserUnsetKeybinding(new KeybindingImpl(keybinding))
    }
    const newBindings = settingStore.get('Comfy.Keybinding.NewBindings')
    for (const keybinding of newBindings) {
      if (isExcludedFromDistribution(keybinding)) continue
      keybindingStore.addUserKeybinding(new KeybindingImpl(keybinding))
    }
  }

  async function persistUserKeybindings() {
    await settingStore.setMany({
      'Comfy.Keybinding.NewBindings': keybindingStore.getUserKeybindingValues(),
      'Comfy.Keybinding.UnsetBindings':
        keybindingStore.getUserUnsetKeybindingValues()
    })
  }

  return {
    listenForKeydowns,
    executeCanvasKeybinding,
    keybindHandler,
    registerCoreKeybindings,
    registerUserKeybindings,
    persistUserKeybindings
  }
}
