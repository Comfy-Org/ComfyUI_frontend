import { watch, watchEffect } from 'vue'

import { t } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { ComfyCommandImpl } from '@/stores/commandStore'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import { isModalOpen } from '@/utils/modalUtil'

import type { ContextSnapshot } from './contextKeyStore'
import { useContextKeyStore } from './contextKeyStore'
import { CORE_KEYBINDINGS } from './defaults'
import { consultEscapeOverride } from './escapeOverride'
import { createHoldBindings } from './holdBindings'
import { KeyComboImpl } from './keyCombo'
import { KeybindingImpl } from './keybinding'
import type { KeybindingSource } from './keybindingStore'
import { useKeybindingStore } from './keybindingStore'
import { legacyBindings } from './persistence'
import { useRuntimeKeybindingStore } from './runtimeKeybindingStore'
import { zKeybindingSettings } from './types'
import type { WhenClause } from './whenClause'
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

/** Menus, menubars and popover layers own Escape; dialog content does not. */
function ownsEscape(target: Element): boolean {
  const layer = target.closest(
    '[role="menu"], [role="menubar"], [data-dismissable-layer]'
  )
  return (
    layer !== null &&
    !(
      layer.getAttribute('role') === 'dialog' &&
      layer.closest('[data-reka-popper-content-wrapper]') === null
    )
  )
}

const COMPOSITE_WIDGETS =
  '[role="menu"], [role="listbox"], [role="combobox"], [role="tree"], [role="tablist"]'
const ACTIVATABLE_CONTROLS =
  'button, a[href], input, select, [role="button"], [role="checkbox"], [role="radio"], video[controls], audio[controls]'
const RANGED_CONTROLS =
  'select, input[type="range"], input[type="radio"], [role="slider"], [role="spinbutton"]'
const NAVIGATION_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown'
])

function closesOpenPopup(target: Element, combo: KeyComboImpl): boolean {
  return (
    combo.key === 'Escape' &&
    !combo.hasModifier &&
    target.closest('[aria-haspopup][aria-expanded="true"]') !== null
  )
}

function activatesControl(target: Element, combo: KeyComboImpl): boolean {
  return (
    (combo.key === ' ' || combo.key === 'Enter') &&
    target.closest(ACTIVATABLE_CONTROLS) !== null
  )
}

function navigatesControl(target: Element, combo: KeyComboImpl): boolean {
  return (
    NAVIGATION_KEYS.has(combo.key) && target.closest(RANGED_CONTROLS) !== null
  )
}

function isNativeControlKey(target: Element, combo: KeyComboImpl): boolean {
  if (combo.isReservedByTextInput && target.closest(COMPOSITE_WIDGETS))
    return true
  if (closesOpenPopup(target, combo)) return true
  if (combo.ctrl || combo.alt) return false
  return activatesControl(target, combo) || navigatesControl(target, combo)
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

/** The binding's clause, or undefined when it does not parse. */
function clauseOf(keybinding: KeybindingImpl): WhenClause | undefined {
  if (keybinding.when === undefined) return []
  const parsed = parseWhenClause(keybinding.when)
  return parsed.success ? parsed.clause : undefined
}

/**
 * Reserved combos stay out of text inputs unless the clause asks for one.
 * Only core and user bindings may ask: the app contains credential inputs,
 * so an extension cannot route keys out of them.
 */
function clauseHolds(
  keybinding: KeybindingImpl,
  source: KeybindingSource,
  context: ContextSnapshot
): boolean {
  const clause = clauseOf(keybinding)
  if (!clause) return false
  const optsIntoTextInput =
    source.tier !== 'extension' &&
    clause.some((atom) => atom.key === 'textInputFocus')
  if (
    context.textInputFocus &&
    keybinding.combo.isReservedByTextInput &&
    !optsIntoTextInput
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

/** Keys the dispatcher never claims: already handled, composing, or a bare modifier. */
function isUnclaimable(event: KeyboardEvent, combo: KeyComboImpl): boolean {
  return (
    event.defaultPrevented ||
    event.isComposing ||
    event.keyCode === 229 ||
    combo.isModifier
  )
}

function isIgnoredNode(node: EventTarget): boolean {
  return (
    node instanceof Element && node.hasAttribute('data-comfy-keybinding-ignore')
  )
}

/** The element a keydown applies to, or undefined when a native control or overlay owns it. */
function dispatchTarget(
  event: KeyboardEvent,
  combo: KeyComboImpl
): Element | undefined {
  if (isUnclaimable(event, combo)) return
  const path = event.composedPath()
  if (path.some(isIgnoredNode)) return
  // Safari targets `document` when nothing has focus.
  const target = path[0] instanceof Element ? path[0] : document.body
  if (isNativeControlKey(target, combo)) return
  if (event.key === 'Escape' && ownsEscape(target)) return
  return target
}

function isBareEscape(
  event: KeyboardEvent,
  combo: KeyComboImpl,
  context: ContextSnapshot
): boolean {
  return event.key === 'Escape' && !combo.hasModifier && !context.textInputFocus
}

function runMetadata(commandId: string) {
  return RUN_COMMAND_IDS.has(commandId)
    ? { trigger_source: 'keybinding' }
    : undefined
}

function allowsModal(binding: KeybindingImpl): boolean {
  return (
    clauseOf(binding)?.some(
      (atom) => atom.key === 'modalOpen' && !atom.negated
    ) === true
  )
}

export function useKeybindingService() {
  const keybindingStore = useKeybindingStore()
  const commandStore = useCommandStore()
  const settingStore = useSettingStore()
  const dialogStore = useDialogStore()
  const contextKeyStore = useContextKeyStore()

  function buildContext(
    target: Element,
    bindings: readonly KeybindingImpl[]
  ): ContextSnapshot {
    const keys = new Set<string>()
    for (const binding of bindings) {
      const parsed = binding.when && parseWhenClause(binding.when)
      if (parsed && parsed.success) {
        for (const atom of parsed.clause) keys.add(atom.key)
      }
    }
    return {
      ...contextKeyStore.snapshot(keys),
      modalOpen: isModalOpen(dialogStore.dialogStack.length),
      textInputFocus: isTextInput(target)
    }
  }

  const runtime = useRuntimeKeybindingStore()
  const reported = new Set<string>()

  function shouldReport(
    operation: string,
    binding: KeybindingImpl | undefined,
    warning: boolean
  ): boolean {
    if (!warning && operation !== 'dispatching') return true
    const identity = `${operation}:${binding?.serialize() ?? ''}`
    if (reported.has(identity) || reported.size >= 256) return false
    reported.add(identity)
    return true
  }

  function failureTags(binding: KeybindingImpl | undefined) {
    const source = binding && keybindingStore.sourceOf(binding)
    return {
      command_id: binding?.commandId,
      source_tier: source?.tier,
      extension: source?.tier === 'extension' ? source.name : undefined
    }
  }

  function reportFailure(
    error: unknown,
    operation: 'dispatching' | 'executing' | 'releasing' | 'loading',
    binding?: KeybindingImpl,
    warning = false
  ) {
    if (!shouldReport(operation, binding, warning)) return
    reportError(error, {
      errorType: `error_${operation}_keybinding`,
      surface: 'platform',
      level: warning ? 'warning' : 'error',
      tags: failureTags(binding)
    })
    if (!warning && operation === 'executing') {
      useToastStore().add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('g.keybindingFailed')
      })
    }
  }

  const holds = createHoldBindings((error, binding, phase) =>
    reportFailure(
      error,
      phase === 'release' ? 'releasing' : 'executing',
      binding
    )
  )

  function reportUnavailable(message: string, keybinding: KeybindingImpl) {
    reportFailure(new Error(message), 'dispatching', keybinding, true)
  }

  function commandsAvailable(keybinding: KeybindingImpl): boolean {
    if (!commandStore.isRegistered(keybinding.commandId)) {
      reportUnavailable('Shortcut command is unavailable', keybinding)
      return false
    }
    if (!runtime.isAvailable(keybinding.commandId)) return false
    const { releaseCommandId } = keybinding
    if (releaseCommandId && !commandStore.isRegistered(releaseCommandId)) {
      reportUnavailable('Shortcut release command is unavailable', keybinding)
      return false
    }
    return true
  }

  function pressHold(
    keybinding: KeybindingImpl,
    event: KeyboardEvent,
    releaseCommand: ComfyCommandImpl
  ) {
    const command = commandStore.getCommand(keybinding.commandId)
    const provider = runtime.resolve(keybinding.commandId)
    holds.press(keybinding, event, {
      press: () =>
        provider
          ? provider.run(event)
          : command.function(runMetadata(keybinding.commandId)),
      release: () =>
        provider?.release ? provider.release() : releaseCommand.function(),
      isActive: () =>
        commandStore.getCommand(keybinding.commandId) === command &&
        commandStore.getCommand(releaseCommand.id) === releaseCommand &&
        (!provider || runtime.resolve(keybinding.commandId) === provider)
    })
  }

  function execute(keybinding: KeybindingImpl, event: KeyboardEvent) {
    if (!commandsAvailable(keybinding)) return
    if (keybinding.preventDefault !== false) event.preventDefault()
    const releaseCommand = keybinding.releaseCommandId
      ? commandStore.getCommand(keybinding.releaseCommandId)
      : undefined
    if (event.repeat && (keybinding.allowRepeat === false || releaseCommand))
      return
    if (releaseCommand) {
      pressHold(keybinding, event, releaseCommand)
      return
    }
    const provider = runtime.resolve(keybinding.commandId)
    void commandStore
      .execute(keybinding.commandId, {
        metadata: provider
          ? { keybindingEvent: event }
          : runMetadata(keybinding.commandId),
        errorHandler: (error) => reportFailure(error, 'executing', keybinding)
      })
      .catch((error: unknown) => reportFailure(error, 'executing', keybinding))
  }

  function isEligible(
    binding: KeybindingImpl,
    target: Element,
    context: ContextSnapshot
  ) {
    if (!isWithinTargetElement(binding, target)) return false
    if (!clauseHolds(binding, keybindingStore.sourceOf(binding), context))
      return false
    return runtime.isAvailable(binding.commandId)
  }

  function activeDialogKeybindings(combo: KeyComboImpl) {
    const dialogKey = dialogStore.activeKey
    return dialogKey === null
      ? []
      : keybindingStore.getKeybindings(combo, dialogKey)
  }

  /** A modal blocks workspace bindings that do not opt in with `modalOpen`. */
  function blockedByModal(
    keybinding: KeybindingImpl,
    combo: KeyComboImpl,
    context: ContextSnapshot,
    event: KeyboardEvent
  ): boolean {
    if (!context.modalOpen || allowsModal(keybinding)) return false
    if (combo.ctrl) event.preventDefault()
    return true
  }

  function dispatch(event: KeyboardEvent) {
    const keyCombo = KeyComboImpl.fromEvent(event)
    const target = dispatchTarget(event, keyCombo)
    if (!target) return

    const scopedCandidates = activeDialogKeybindings(keyCombo)
    const candidates = keybindingStore
      .getKeybindings(keyCombo)
      .filter((binding) => isWithinTargetElement(binding, target))
    const context = buildContext(target, [...scopedCandidates, ...candidates])
    const eligible = (binding: KeybindingImpl) =>
      isEligible(binding, target, context)
    const scoped = scopedCandidates.find(eligible)
    if (scoped) {
      execute(scoped, event)
      return
    }
    const keybinding = candidates.find(eligible)
    if (!keybinding) {
      if (candidates.length === 0 && isBareEscape(event, keyCombo, context))
        closeLegacyModals()
      return
    }
    if (blockedByModal(keybinding, keyCombo, context, event)) return
    // A registered override (e.g. the agent composer owning Escape while a
    // turn is running) wins over the workspace binding, but only after menus
    // and dialogs have had first refusal above.
    if (event.key === 'Escape' && consultEscapeOverride(event)) {
      event.preventDefault()
      return
    }
    execute(keybinding, event)
  }

  function keybindHandler(event: KeyboardEvent) {
    try {
      dispatch(event)
    } catch (error) {
      holds.releaseAll()
      reportFailure(error, 'dispatching')
    }
  }

  function reconcileHolds() {
    try {
      const target = document.activeElement ?? document.body
      holds.reconcile((binding) => {
        const context = buildContext(target, [binding])
        return (
          keybindingStore.keybindings.includes(binding) &&
          isEligible(binding, target, context) &&
          (binding.dialogKey
            ? binding.dialogKey === dialogStore.activeKey
            : !context.modalOpen || allowsModal(binding))
        )
      })
    } catch (error) {
      holds.releaseAll()
      reportFailure(error, 'dispatching')
    }
  }

  function install() {
    const stopPhase = watch(
      () => settingStore.get('Comfy.Keybinding.CapturePhase'),
      (capture, _, onCleanup) => {
        holds.releaseAll()
        window.addEventListener('keydown', keybindHandler, { capture })
        onCleanup(() =>
          window.removeEventListener('keydown', keybindHandler, { capture })
        )
      },
      { immediate: true, flush: 'sync' }
    )
    const stopReconcile = watchEffect(reconcileHolds)
    const onVisibility = () => {
      if (document.hidden) holds.releaseAll()
    }
    window.addEventListener('keyup', holds.keyup, true)
    window.addEventListener('blur', holds.releaseAll)
    window.addEventListener('focusin', reconcileHolds, true)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stopPhase()
      stopReconcile()
      holds.releaseAll()
      window.removeEventListener('keyup', holds.keyup, true)
      window.removeEventListener('blur', holds.releaseAll)
      window.removeEventListener('focusin', reconcileHolds, true)
      document.removeEventListener('visibilitychange', onVisibility)
    }
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
    try {
      const settings = zKeybindingSettings.parse(
        settingStore.get('Comfy.Keybinding.SettingsV1') ?? {
          version: 1,
          newBindings: settingStore.get('Comfy.Keybinding.NewBindings'),
          unsetBindings: settingStore.get('Comfy.Keybinding.UnsetBindings'),
          currentPreset: settingStore.get('Comfy.Keybinding.CurrentPreset')
        }
      )
      keybindingStore.loadUserKeybindings({
        newBindings: settings.newBindings.filter(
          (binding) =>
            !isCloud ||
            binding.commandId !== 'Workspace.ToggleBottomPanelTab.logs-terminal'
        ),
        unsetBindings: settings.unsetBindings
      })
      keybindingStore.currentPresetName = settings.currentPreset
    } catch {
      reportFailure(
        new Error('Stored keyboard shortcuts could not be loaded'),
        'loading',
        undefined,
        true
      )
    }
  }

  async function persistUserKeybindings() {
    const newBindings = keybindingStore.getUserKeybindings()
    const unsetBindings = keybindingStore.getUserUnsetKeybindings()
    await settingStore.setMany({
      'Comfy.Keybinding.SettingsV1': {
        version: 1,
        newBindings,
        unsetBindings,
        currentPreset: keybindingStore.currentPresetName
      },
      'Comfy.Keybinding.NewBindings': legacyBindings(newBindings),
      'Comfy.Keybinding.UnsetBindings': legacyBindings(unsetBindings)
    })
  }

  return {
    keybindHandler,
    install,
    registerCoreKeybindings,
    registerUserKeybindings,
    persistUserKeybindings
  }
}
