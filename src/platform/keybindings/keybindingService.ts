import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import { isModalOpen } from '@/utils/modalUtil'

import type { ContextSnapshot } from './contextKeyStore'
import { useContextKeyStore } from './contextKeyStore'
import { CORE_KEYBINDINGS } from './defaults'
import { KeyComboImpl } from './keyCombo'
import { KeybindingImpl } from './keybinding'
import { useKeybindingStore } from './keybindingStore'
import { matchesContext, parseWhenClause } from './whenClause'

const RUN_COMMAND_IDS = new Set([
  'Comfy.QueuePrompt',
  'Comfy.QueuePromptFront',
  'Comfy.QueueSelectedOutputNodes'
])

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit'
])

function isTextInput(target: Element): boolean {
  if (target instanceof HTMLInputElement) {
    return !NON_TEXT_INPUT_TYPES.has(target.type)
  }
  return (
    target.tagName === 'TEXTAREA' ||
    (target instanceof HTMLElement && target.isContentEditable) ||
    (target.tagName === 'SPAN' && target.classList.contains('property_value'))
  )
}

/** Menus and Reka dismissable layers own Escape. */
function ownsEscape(target: Element): boolean {
  return target.closest('[role="menu"], [data-dismissable-layer]') !== null
}

function isWithinTargetElement(
  keybinding: KeybindingImpl,
  target: Element
): boolean {
  if (!keybinding.targetElementId) return true
  const targetElementId =
    keybinding.targetElementId === 'graph-canvas'
      ? 'graph-canvas-container'
      : keybinding.targetElementId
  return document.getElementById(targetElementId)?.contains(target) ?? false
}

/** Reserved combos stay out of text inputs unless the clause asks for one. */
function clauseHolds(
  keybinding: KeybindingImpl,
  context: ContextSnapshot
): boolean {
  const parsed =
    keybinding.when === undefined ? undefined : parseWhenClause(keybinding.when)
  if (parsed && !parsed.success) return false
  const clause = parsed?.clause ?? []
  if (
    context.textInputFocus &&
    keybinding.combo.isReservedByTextInput &&
    !clause.some((atom) => atom.key === 'textInputFocus')
  ) {
    return false
  }
  return matchesContext(clause, context)
}

function closeLegacyModals() {
  const modals = document.querySelectorAll<HTMLElement>('.comfy-modal')
  for (const modal of modals) {
    const modalDisplay = window
      .getComputedStyle(modal)
      .getPropertyValue('display')

    if (modalDisplay !== 'none') {
      modal.style.display = 'none'
      break
    }
  }

  for (const d of document.querySelectorAll('dialog')) d.close()
}

export function useKeybindingService() {
  const keybindingStore = useKeybindingStore()
  const commandStore = useCommandStore()
  const settingStore = useSettingStore()
  const dialogStore = useDialogStore()
  const contextKeyStore = useContextKeyStore()

  function buildContext(target: Element): ContextSnapshot {
    return {
      ...contextKeyStore.snapshot(),
      modalOpen: isModalOpen(dialogStore.dialogStack.length),
      textInputFocus: isTextInput(target)
    }
  }

  async function execute(keybinding: KeybindingImpl, event: KeyboardEvent) {
    if (!commandStore.isRegistered(keybinding.commandId)) {
      console.warn(
        `Keybinding ${keybinding.combo} targets unknown command ${keybinding.commandId}`
      )
      return
    }
    event.preventDefault()
    if (RUN_COMMAND_IDS.has(keybinding.commandId)) {
      await commandStore.execute(keybinding.commandId, {
        metadata: {
          trigger_source: 'keybinding'
        }
      })
    } else {
      await commandStore.execute(keybinding.commandId)
    }
  }

  async function keybindHandler(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing) return

    const keyCombo = KeyComboImpl.fromEvent(event)
    if (keyCombo.isModifier) return

    const target = event.composedPath()[0]
    if (!(target instanceof Element)) return
    if (event.key === 'Escape' && ownsEscape(target)) return

    const context = buildContext(target)
    const activeDialogKey = dialogStore.activeKey ?? undefined
    const scoped =
      activeDialogKey === undefined
        ? undefined
        : keybindingStore
            .getKeybindings(keyCombo, activeDialogKey)
            .find(
              (binding) =>
                isWithinTargetElement(binding, target) &&
                clauseHolds(binding, context)
            )
    if (scoped) {
      await execute(scoped, event)
      return
    }

    const candidates = keybindingStore
      .getKeybindings(keyCombo)
      .filter((binding) => isWithinTargetElement(binding, target))
    const keybinding = candidates.find((binding) =>
      clauseHolds(binding, context)
    )
    if (!keybinding) {
      const bare = !keyCombo.ctrl && !keyCombo.alt
      const inTextInput =
        keyCombo.isReservedByTextInput && context.textInputFocus
      if (
        candidates.length === 0 &&
        event.key === 'Escape' &&
        bare &&
        !inTextInput
      ) {
        closeLegacyModals()
      }
      return
    }
    if (context.modalOpen) {
      // Bare keys still have to reach inputs inside the dialog.
      if (keyCombo.ctrl) event.preventDefault()
      return
    }
    await execute(keybinding, event)
  }

  function registerCoreKeybindings() {
    for (const keybinding of CORE_KEYBINDINGS) {
      if (
        isCloud &&
        keybinding.commandId === 'Workspace.ToggleBottomPanelTab.logs-terminal'
      ) {
        continue
      }
      keybindingStore.addDefaultKeybinding(new KeybindingImpl(keybinding))
    }
  }

  function registerUserKeybindings() {
    const unsetBindings = settingStore.get('Comfy.Keybinding.UnsetBindings')
    for (const keybinding of unsetBindings) {
      if (!commandStore.isRegistered(keybinding.commandId)) {
        continue
      }
      keybindingStore.unsetKeybinding(new KeybindingImpl(keybinding))
    }
    const newBindings = settingStore.get('Comfy.Keybinding.NewBindings')
    for (const keybinding of newBindings) {
      if (
        isCloud &&
        keybinding.commandId === 'Workspace.ToggleBottomPanelTab.logs-terminal'
      ) {
        continue
      }
      keybindingStore.addUserKeybinding(new KeybindingImpl(keybinding))
    }
  }

  async function persistUserKeybindings() {
    await settingStore.setMany({
      'Comfy.Keybinding.NewBindings': keybindingStore.getUserKeybindings(),
      'Comfy.Keybinding.UnsetBindings':
        keybindingStore.getUserUnsetKeybindings()
    })
  }

  return {
    keybindHandler,
    registerCoreKeybindings,
    registerUserKeybindings,
    persistUserKeybindings
  }
}
