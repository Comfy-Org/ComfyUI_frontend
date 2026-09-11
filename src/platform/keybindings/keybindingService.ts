import { watch, watchEffect } from 'vue'

import { t } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import { isModalOpen } from '@/utils/modalUtil'

import type { ContextSnapshot } from './contextKeyStore'
import { useContextKeyStore } from './contextKeyStore'
import { CORE_KEYBINDINGS } from './defaults'
import { createHoldBindings } from './holdBindings'
import { KeyComboImpl } from './keyCombo'
import { KeybindingImpl } from './keybinding'
import type { KeybindingSource } from './keybindingStore'
import { useKeybindingStore } from './keybindingStore'
import { legacyBindings } from './persistence'
import { useRuntimeKeybindingStore } from './runtimeKeybindingStore'
import { zKeybindingSettings } from './types'
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
  const layer = target.closest('[role="menu"], [data-dismissable-layer]')
  return (
    layer !== null &&
    !(
      layer.getAttribute('role') === 'dialog' &&
      layer.closest('[data-reka-popper-content-wrapper]') === null
    )
  )
}

function isNativeControlKey(target: Element, combo: KeyComboImpl): boolean {
  if (
    combo.isReservedByTextInput &&
    target.closest(
      '[role="menu"], [role="listbox"], [role="combobox"], [role="tree"], [role="tablist"]'
    )
  )
    return true
  if (
    combo.key === 'Escape' &&
    !combo.hasModifier &&
    target.closest('[aria-haspopup][aria-expanded="true"]')
  )
    return true
  if (combo.ctrl || combo.alt) return false
  if (
    (combo.key === ' ' || combo.key === 'Enter') &&
    target.closest(
      'button, a[href], input, select, [role="button"], [role="checkbox"], [role="radio"], video[controls], audio[controls]'
    )
  )
    return true
  return (
    [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'PageUp',
      'PageDown'
    ].includes(combo.key) &&
    target.closest(
      'select, input[type="range"], input[type="radio"], [role="slider"], [role="spinbutton"]'
    ) !== null
  )
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
  const parsed =
    keybinding.when === undefined ? undefined : parseWhenClause(keybinding.when)
  if (parsed && !parsed.success) return false
  const clause = parsed?.clause ?? []
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

  function reportFailure(
    error: unknown,
    operation: 'dispatching' | 'executing' | 'releasing' | 'loading',
    binding?: KeybindingImpl,
    warning = false
  ) {
    const source = binding && keybindingStore.sourceOf(binding)
    const identity = `${operation}:${binding?.serialize() ?? ''}`
    const deduplicate = warning || operation === 'dispatching'
    if (deduplicate && (reported.has(identity) || reported.size >= 256)) return
    if (deduplicate) reported.add(identity)
    reportError(error, {
      errorType: `error_${operation}_keybinding`,
      level: warning ? 'warning' : 'error',
      tags: {
        command_id: binding?.commandId,
        source_tier: source?.tier,
        extension: source?.tier === 'extension' ? source.name : undefined
      }
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

  function execute(keybinding: KeybindingImpl, event: KeyboardEvent) {
    const command = commandStore.getCommand(keybinding.commandId)
    if (!commandStore.isRegistered(keybinding.commandId)) {
      reportFailure(
        new Error('Shortcut command is unavailable'),
        'dispatching',
        keybinding,
        true
      )
      return
    }
    if (!runtime.isAvailable(keybinding.commandId)) return
    const releaseCommand = keybinding.releaseCommandId
      ? commandStore.getCommand(keybinding.releaseCommandId)
      : undefined
    if (
      keybinding.releaseCommandId &&
      !commandStore.isRegistered(keybinding.releaseCommandId)
    ) {
      reportFailure(
        new Error('Shortcut release command is unavailable'),
        'dispatching',
        keybinding,
        true
      )
      return
    }
    if (keybinding.preventDefault !== false) event.preventDefault()
    if (event.repeat && (keybinding.allowRepeat === false || releaseCommand))
      return
    const metadata = RUN_COMMAND_IDS.has(keybinding.commandId)
      ? { trigger_source: 'keybinding' }
      : undefined
    const provider = runtime.resolve(keybinding.commandId)
    if (releaseCommand) {
      holds.press(keybinding, event, {
        press: () =>
          provider ? provider.run(event) : command.function(metadata),
        release: () =>
          provider?.release ? provider.release() : releaseCommand.function(),
        isActive: () =>
          commandStore.getCommand(keybinding.commandId) === command &&
          commandStore.getCommand(keybinding.releaseCommandId ?? '') ===
            releaseCommand &&
          (!provider || runtime.resolve(keybinding.commandId) === provider)
      })
      return
    }
    void commandStore
      .execute(keybinding.commandId, {
        metadata: provider ? { keybindingEvent: event } : metadata,
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

  function allowsModal(binding: KeybindingImpl): boolean {
    const parsed = binding.when && parseWhenClause(binding.when)
    return (
      !!parsed &&
      parsed.success &&
      parsed.clause.some((atom) => atom.key === 'modalOpen' && !atom.negated)
    )
  }

  function dispatch(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229)
      return
    const keyCombo = KeyComboImpl.fromEvent(event)
    if (keyCombo.isModifier) return
    const path = event.composedPath()
    if (
      path.some(
        (node) =>
          node instanceof Element &&
          node.hasAttribute('data-comfy-keybinding-ignore')
      )
    )
      return
    const target = path[0]
    if (!(target instanceof Element)) return
    if (isNativeControlKey(target, keyCombo)) return
    if (event.key === 'Escape' && ownsEscape(target)) return

    const activeDialogKey = dialogStore.activeKey ?? undefined
    const scopedCandidates =
      activeDialogKey === undefined
        ? []
        : keybindingStore.getKeybindings(keyCombo, activeDialogKey)
    const candidates = keybindingStore
      .getKeybindings(keyCombo)
      .filter((binding) => isWithinTargetElement(binding, target))
    const context = buildContext(target, [...scopedCandidates, ...candidates])
    const scoped = scopedCandidates.find((binding) =>
      isEligible(binding, target, context)
    )
    if (scoped) {
      execute(scoped, event)
      return
    }
    const keybinding = candidates.find((binding) =>
      isEligible(binding, target, context)
    )
    if (!keybinding) {
      if (
        candidates.length === 0 &&
        event.key === 'Escape' &&
        !keyCombo.hasModifier &&
        !context.textInputFocus
      ) {
        closeLegacyModals()
      }
      return
    }
    if (context.modalOpen && !allowsModal(keybinding)) {
      if (keyCombo.ctrl) event.preventDefault()
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
