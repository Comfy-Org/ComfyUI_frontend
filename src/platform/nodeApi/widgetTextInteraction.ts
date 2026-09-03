import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface WidgetTextSelection {
  readonly start: number
  readonly end: number
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface WidgetTextEventBase {
  readonly value: string
  readonly selection: WidgetTextSelection
  /** Positions a host menu at the text editor without exposing its element. */
  readonly menuEvent: MouseEvent
  /** Commits through the widget protocol and optionally restores the caret. */
  setValue(value: string, selection?: WidgetTextSelection): void
  focus(): void
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface WidgetTextInputEvent extends WidgetTextEventBase {
  readonly kind: 'input' | 'selection'
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface WidgetTextWheelEvent extends WidgetTextEventBase {
  readonly kind: 'wheel'
  readonly deltaY: number
  readonly ctrlKey: boolean
  /** Claims the wheel gesture so the canvas does not pan or zoom. */
  preventDefault(): void
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface WidgetTextKeyEvent extends WidgetTextEventBase {
  readonly kind: 'keydown'
  readonly key: string
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
  readonly metaKey: boolean
  readonly repeat: boolean
  preventDefault(): void
  stopPropagation(): void
}

/**
 * An interaction with a host-owned multiline text editor.
 *
 * This is the renderer-independent replacement for reaching through
 * `widget.inputEl`: packs can inspect the live caret, offer a menu through
 * `menuEvent`, replace text, and implement selection-based wheel edits without
 * receiving the host's element or markup.
 */
export type WidgetTextInteractionEvent =
  | WidgetTextInputEvent
  | WidgetTextWheelEvent
  | WidgetTextKeyEvent

type Subscription = {
  readonly listener: (event: WidgetTextInteractionEvent) => void
  readonly commit: (value: string) => void
}

const subscriptions = new WeakMap<IBaseWidget, Set<Subscription>>()

export function subscribeWidgetTextInteraction(
  widget: IBaseWidget,
  listener: (event: WidgetTextInteractionEvent) => void,
  commit: (value: string) => void
): () => void {
  let entries = subscriptions.get(widget)
  if (!entries) {
    entries = new Set()
    subscriptions.set(widget, entries)
  }
  const subscription = { listener, commit }
  entries.add(subscription)
  return () => entries.delete(subscription)
}

function menuEventFor(element: HTMLTextAreaElement): MouseEvent {
  const bounds = element.getBoundingClientRect()
  return new MouseEvent('contextmenu', {
    clientX: bounds.left + 10,
    clientY: bounds.bottom + 10
  })
}

function applyViewValue(
  element: HTMLTextAreaElement,
  value: string,
  selection?: WidgetTextSelection
): void {
  element.value = value
  if (selection) element.setSelectionRange(selection.start, selection.end)
  queueMicrotask(() => {
    element.value = value
    if (selection) element.setSelectionRange(selection.start, selection.end)
  })
}

export function dispatchWidgetTextInteraction(
  widget: IBaseWidget,
  element: HTMLTextAreaElement,
  kind: 'input' | 'selection',
  sourceEvent: Event
): void
export function dispatchWidgetTextInteraction(
  widget: IBaseWidget,
  element: HTMLTextAreaElement,
  kind: 'wheel',
  sourceEvent: WheelEvent
): void
export function dispatchWidgetTextInteraction(
  widget: IBaseWidget,
  element: HTMLTextAreaElement,
  kind: 'keydown',
  sourceEvent: KeyboardEvent
): void
export function dispatchWidgetTextInteraction(
  widget: IBaseWidget,
  element: HTMLTextAreaElement,
  kind: 'input' | 'selection' | 'wheel' | 'keydown',
  sourceEvent: Event
): void {
  const entries = subscriptions.get(widget)
  if (!entries?.size) return

  const selection = Object.freeze({
    start: element.selectionStart,
    end: element.selectionEnd
  })
  const common = {
    value: element.value,
    selection,
    menuEvent: menuEventFor(element),
    focus: () => element.focus()
  }

  for (const subscription of entries) {
    const setValue = (value: string, next?: WidgetTextSelection) => {
      subscription.commit(value)
      applyViewValue(element, value, next)
    }
    if (kind === 'wheel') {
      if (!(sourceEvent instanceof WheelEvent)) return
      subscription.listener(
        Object.freeze({
          ...common,
          kind,
          deltaY: sourceEvent.deltaY,
          ctrlKey: sourceEvent.ctrlKey,
          setValue,
          preventDefault: () => sourceEvent.preventDefault()
        })
      )
      continue
    }
    if (kind === 'keydown') {
      if (!(sourceEvent instanceof KeyboardEvent)) return
      subscription.listener(
        Object.freeze({
          ...common,
          kind,
          key: sourceEvent.key,
          ctrlKey: sourceEvent.ctrlKey,
          altKey: sourceEvent.altKey,
          shiftKey: sourceEvent.shiftKey,
          metaKey: sourceEvent.metaKey,
          repeat: sourceEvent.repeat,
          setValue,
          preventDefault: () => sourceEvent.preventDefault(),
          stopPropagation: () => sourceEvent.stopPropagation()
        })
      )
      continue
    }
    subscription.listener(Object.freeze({ ...common, kind, setValue }))
  }
}
