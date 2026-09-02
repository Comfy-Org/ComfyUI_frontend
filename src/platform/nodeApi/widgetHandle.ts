/**
 * Widget handles and the per-node widget collection.
 *
 * This is the surface that retires the largest cohort of breakage:
 * `widgets.splice()` / `widgets = [...]` / `widgets.push()` reordering, and the
 * `widget.widgetType = 'converted-widget'` hack whose real intent was always "hide
 * this widget". Both now have first-class, order-safe replacements.
 */
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  IBaseWidget,
  IWidgetOptions
} from '@/lib/litegraph/src/types/widgets'
import { getWidgetIds } from '@/lib/litegraph/src/utils/widget'
import { commitWidgetValue } from '@/lib/litegraph/src/widgets/commitWidgetValue'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'

import { createHandleFactory } from './closedProxy'
import type { HandleCommon } from './closedProxy'
import { ComfyApiError } from './errors'
import { isEmbeddingWorkflow } from './serializeContext'
import { constructDeclaredWidget } from './widgetTypes'
import { subscribeWidgetTextInteraction } from './widgetTextInteraction'
import type { WidgetTextInteractionEvent } from './widgetTextInteraction'

// `null` is included because core's own `WidgetValue` has it and
// `addWidget('button', name, null, cb)` produced exactly that. Omitting it made
// a null value inexpressible through the published API, so a converted button's
// `widgets_values` entry changed and the saved workflow differed.
export type WidgetValue = string | number | boolean | object | undefined | null

/** Options understood by core or by a widget type declared by the pack. */
/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface WidgetOptions {
  readonly [key: string]: unknown
  readonly on?: string
  readonly off?: string
  readonly max?: number
  readonly min?: number
  readonly precision?: number
  readonly read_only?: boolean
  readonly step?: number
  readonly step2?: number
  readonly multiline?: boolean
  readonly property?: string
  readonly socketless?: boolean
  readonly canvasOnly?: boolean
  readonly hideInPanel?: boolean
  readonly nodeType?: string
  readonly serialize?: boolean
  readonly values?: unknown
  readonly iconClass?: string
  readonly disabled?: boolean
  readonly useGrouping?: boolean
  readonly placeholder?: string
  readonly showThumbnails?: boolean
  readonly showItemNavigators?: boolean
  readonly hidden?: boolean
}

/**
 * Shapes follow `docs/node-api/reference.md`, the published contract.
 *
 * Accessor methods rather than properties, so a read can be a store query and
 * a write can dispatch a command.
 */
export interface WidgetHandle extends HandleCommon {
  readonly name: string
  readonly widgetType: string

  getValue<T = WidgetValue>(): T
  /**
   * Commits a value exactly as a user edit does: the value is written, a
   * widget bound to a node property syncs it, the widget's callback chain and
   * the node's `onWidgetChanged` run, and `graph.version` advances. This
   * replaces the manual pair `widget.value = x; widget.callback?.(x)` — and
   * the bare write too, because a write the rest of the system cannot see was
   * never a feature, it was litegraph defaulting to inconsistency.
   *
   * Writing the current value again is a no-op, which is also what ends a
   * cycle of handlers writing to each other. `on('change')` fires once per
   * commit; `on('activate')` does not fire, because activate reports a user's
   * act.
   */
  setValue(value: WidgetValue): void

  /**
   * The widgets core attached to this one — a seed's `control_after_generate`,
   * a bounding box's components.
   *
   * `setHidden` already cascades through these, so hiding needs no call here.
   * What does is reading one: a pack asks a seed's control widget whether it
   * says `fixed` or `randomize` to know what the node will do next.
   */
  linked(): readonly WidgetHandle[]
  /**
   * Replaces the controls attached to this widget.
   *
   * Core uses this relationship for compound inputs: hiding a seed also hides
   * its `control_after_generate` picker. Packs build the same compound control
   * when they add a random-seed button or an index policy, and assigning
   * `linkedWidgets` directly was the only way to make conversion-to-input hide
   * the whole unit.
   *
   * Every name must identify another widget on this node. Pass an empty array
   * to clear the relationship.
   */
  setLinked(names: readonly string[]): void

  isHidden(): boolean
  /**
   * Replaces the `type = 'converted-widget'` hack. Value is retained.
   *
   * Cascades to the widgets core attached to this one — a seed's
   * `control_after_generate`, a bounding box's components. The legacy
   * `hideWidget` helper this replaces recursed through `linkedWidgets`, and
   * packs that lost the cascade were left with an orphaned control widget
   * floating where its owner used to be.
   */
  setHidden(hidden: boolean): void
  getOptions(): Readonly<WidgetOptions> | undefined
  setOption(key: string, value: unknown): void
  setLabel(label: string): void

  isDisabled(): boolean
  setDisabled(disabled: boolean): void
  isSerialized(): boolean
  /** The height the host most recently allocated, or undefined before layout. */
  getHeight(): number | undefined
  /**
   * Pins the widget's height in graph units, instead of letting it share
   * whatever space the node has spare.
   *
   * The node divides free height between every widget that does not state one,
   * so a node carrying two mounted strips gave each half the node however
   * small they were meant to be. `MountDef.height` does not do this — it sets
   * the container's CSS height *inside* an allocation the renderer already
   * chose, which is why a fixed strip still drifted.
   *
   * Replaces re-assigning `node.computeSize`, which is what packs did and
   * which is not published. Omit it for a panel meant to fill the node: the
   * growable path is the one that fills.
   */
  setHeight(px: number): void

  /**
   * Replaces capture-and-chain on `widget.callback`, which 1,000+ sites do and
   * which silently drops an earlier pack's listener whenever one forgets to
   * call through. Listeners here are additive and independent.
   */
  on(
    event: 'change',
    listener: (value: WidgetValue, oldValue: WidgetValue) => void
  ): Unsubscribe
  on(event: 'removed', listener: () => void): Unsubscribe
  /**
   * The widget was activated — a button click, or a value committed.
   *
   * Buttons carry no value, so `change` can never fire for one and a button
   * created through this API would otherwise be inert. Prefer `change` when you
   * care about the value; use this when you care that the user acted — a
   * programmatic `setValue` never fires it.
   */
  on(event: 'activate', listener: (value: WidgetValue) => void): Unsubscribe
  /**
   * Contributes behavior to a host-owned multiline text editor without exposing
   * its DOM. The event reports the live value and caret on each input,
   * selection change, or wheel gesture; its write method preserves both the
   * widget commit protocol and the requested selection.
   */
  on(
    event: 'textInteraction',
    listener: (event: WidgetTextInteractionEvent) => void
  ): Unsubscribe
  /**
   * The value is about to be written out, and may be replaced for this
   * destination only.
   *
   * This is what `widget.serializeValue` did, and the reason it is back: a
   * static `serialize` flag can only *suppress* a value, and a whole class of
   * packs needs to *supply* a different one. rgthree's Seed keeps the sentinel
   * `-1` in the saved workflow and sends the rolled seed; pysssss' PresetText
   * expands `@name` into the queued prompt while the user keeps seeing the
   * reference; Impact Pack embeds image data the canvas never shows.
   *
   * `context` says which destination is being built, because those packs want
   * to change one and not the other:
   *
   * - `'workflow'` — the file the user saves.
   * - `'prompt'` — the queued API payload the backend executes.
   * - `'embedded'` — the copy of the workflow that travels with that prompt
   *   and is written into the output image. Distinct from `'workflow'`
   *   because a pack may want the image to reproduce the run while the saved
   *   file keeps its sentinel: rgthree's Seed saves `-1` but embeds the seed
   *   it actually rolled, so dragging the PNG back in reproduces it.
   *
   * A handler that ignores `context` changes all three.
   *
   * Calling `setSerializedValue` replaces the value for this write only; the
   * widget itself is untouched, so the user still sees what they typed. Last
   * handler to call it wins.
   */
  on(
    event: 'beforeSerialize',
    listener: (event: WidgetSerializeEvent) => void
  ): Unsubscribe
}

/** Where a value is being written, and the chance to change it. */
export interface WidgetSerializeEvent {
  readonly context: 'workflow' | 'prompt' | 'embedded'
  /** What would be written if no handler intervened. */
  readonly value: WidgetValue
  setSerializedValue(value: WidgetValue): void
}

export type Unsubscribe = () => void

/** `nodeId` and widget name, joined by a character neither may contain. */
const SEP = '\0'
const compositeKey = (nodeId: string, name: string) => `${nodeId}${SEP}${name}`

function findWidget(
  node: LGraphNode | undefined,
  name: string
): IBaseWidget | undefined {
  return node?.widgets?.find((w) => w.name === name)
}

export function createWidgetHandles(
  getGraph: () => LGraph | null | undefined,
  namespace = ''
) {
  const resolveNode = (nodeId: string) =>
    getGraph()?.getNodeById(toNodeId(nodeId)) ?? undefined

  const commit = (
    widget: IBaseWidget,
    node: LGraphNode,
    value: WidgetValue
  ) => {
    programmaticWrites++
    try {
      commitWidgetValue(widget, value as IBaseWidget['value'], { node })
    } finally {
      programmaticWrites--
    }
  }

  const factory = createHandleFactory<IBaseWidget>(
    {
      kind: 'widget',
      props: {
        name: { get: (w) => w.name },
        widgetType: {
          get: (w) => w.type,
          readonlyHint:
            'Widget type is identity. To hide a widget, call setHidden(true).'
        }
      },
      idMethods: {
        linked: (w, id): readonly WidgetHandle[] => {
          const [nodeId] = id.split(SEP)
          return Object.freeze(
            (w.linkedWidgets ?? []).map(
              (linked) =>
                factory.handleFor(
                  compositeKey(nodeId, linked.name)
                ) as WidgetHandle
            )
          )
        },
        setLinked: (w, id, ...args) => {
          const [nodeId] = id.split(SEP)
          const node = resolveNode(nodeId)
          if (!node) return
          const names = args[0] as readonly string[]
          const linked = names.map((name) => {
            const widget = findWidget(node, name)
            if (!widget) {
              throw new ComfyApiError(
                `No widget named '${name}' on this node, so it cannot be linked to '${w.name}'.`
              )
            }
            return widget
          })
          w.linkedWidgets = linked
        },
        setValue: (w, id, ...args) => {
          const [nodeId] = id.split(SEP)
          const node = resolveNode(nodeId)
          if (!node) return
          commit(w, node, args[0] as WidgetValue)
        },
        on: (w, id, ...args) => {
          const [event, listener] = args as unknown as [
            (
              | 'change'
              | 'removed'
              | 'activate'
              | 'beforeSerialize'
              | 'textInteraction'
            ),
            (...a: unknown[]) => void
          ]
          if (event === 'textInteraction') {
            const [nodeId] = id.split(SEP)
            const node = resolveNode(nodeId)
            if (!node) return () => false
            return subscribeWidgetTextInteraction(
              w,
              listener as (event: WidgetTextInteractionEvent) => void,
              (value) => commit(w, node, value)
            )
          }
          if (event === 'beforeSerialize') ensureSerializeBridge(w)
          else if (event !== 'removed') ensureCallbackBridge(w)
          const set =
            event === 'change'
              ? slots(w).change
              : event === 'activate'
                ? slots(w).activate
                : event === 'beforeSerialize'
                  ? slots(w).beforeSerialize
                  : slots(w).removed
          ;(set as Set<unknown>).add(listener)
          return () => (set as Set<unknown>).delete(listener)
        }
      },
      methods: {
        getValue: (w) => w.value as WidgetValue,
        isHidden: (w) => w.hidden ?? false,
        setHidden: (w, ...args) => {
          const hidden = Boolean(args[0])
          const seen = new Set<IBaseWidget>()
          const apply = (widget: IBaseWidget) => {
            if (seen.has(widget)) return
            seen.add(widget)
            widget.hidden = hidden
            widget.linkedWidgets?.forEach(apply)
          }
          apply(w)
        },
        isDisabled: (w) => w.disabled ?? false,
        setDisabled: (w, ...args) => {
          w.disabled = Boolean(args[0])
        },
        setLabel: (w, ...args) => {
          w.label = args[0] === undefined ? undefined : String(args[0])
        },
        isSerialized: (w) => w.serialize ?? true,
        getHeight: (w) => w.computedHeight,
        setHeight: (w, ...args) => {
          const px = Number(args[0])
          if (!Number.isFinite(px) || px < 0) {
            throw new ComfyApiError(
              `A widget height must be a non-negative number of graph units, got '${String(args[0])}'.`
            )
          }
          // Presence of `computeSize` is itself the signal: the node treats a
          // widget that has one as fixed and every other widget as growable
          // (`LGraphNode._arrangeWidgets`).
          w.computeSize = (width?: number) => [width ?? 0, px]
        },
        // Reads snapshot accessor values by design — a frozen copy must be
        // inert. Use `setOptions` to preserve live getters when writing.
        getOptions: (w) =>
          Object.freeze({ ...w.options }) as Readonly<WidgetOptions>,
        setOption: (w, ...args) => {
          const [key, value] = args as unknown as [string, unknown]
          const patch = { [key]: value } as Partial<IWidgetOptions>
          // Descriptor-preserving merge. Spreading would invoke any accessor
          // and freeze its result: packs commonly define `values` as a live
          // getter for dynamic combos, and a spread silently pins it to a
          // one-time snapshot.
          w.options = Object.defineProperties(
            {},
            {
              ...Object.getOwnPropertyDescriptors(w.options ?? {}),
              ...Object.getOwnPropertyDescriptors(patch)
            }
          ) as IWidgetOptions
        }
        // Removal is resolved from the key, not from the widget: reaching
        // through `w.node` would be exactly the internal coupling this layer
        // exists to remove.
      }
    },
    (key) => {
      const [nodeId, name] = key.split(SEP)
      return findWidget(resolveNode(nodeId), name)
    },
    namespace
  )

  /**
   * Listeners, keyed by the widget object.
   *
   * Not by name: a widget removed and recreated under the same name is a
   * different widget, and a listener left over from the old one would fire for
   * a widget its owner never saw. A WeakMap also lets the entry go when the
   * widget does.
   */
  const listeners = new WeakMap<
    object,
    {
      change: Set<(v: WidgetValue, o: WidgetValue) => void>
      removed: Set<() => void>
      activate: Set<(v: WidgetValue) => void>
      beforeSerialize: Set<(e: WidgetSerializeEvent) => void>
    }
  >()

  const slots = (w: object) => {
    let found = listeners.get(w)
    if (!found) {
      found = {
        change: new Set(),
        removed: new Set(),
        activate: new Set(),
        beforeSerialize: new Set()
      }
      listeners.set(w, found)
    }
    return found
  }

  /**
   * Runs the handlers for one destination and returns what should be written.
   *
   * Returns the widget's own value untouched when nothing intervened, so a
   * widget with no handler serialises exactly as before.
   */
  function serializedValue(
    w: object,
    context: 'workflow' | 'prompt' | 'embedded',
    value: WidgetValue
  ): WidgetValue {
    const handlers = listeners.get(w)?.beforeSerialize
    if (!handlers?.size) return value
    let result = value
    const event: WidgetSerializeEvent = {
      context,
      value,
      setSerializedValue: (next) => {
        result = next
      }
    }
    for (const handler of handlers) handler(event)
    return result
  }

  const lastNotified = new WeakMap<object, WidgetValue>()

  function notify(w: object, value: WidgetValue, previous: WidgetValue) {
    if (value === previous) return
    for (const listener of listeners.get(w)?.change ?? []) {
      listener(value, previous)
    }
  }

  /**
   * Routes litegraph's own callback into the listener set.
   *
   * Wrapped once per widget, and the pack's existing callback is still called:
   * during the migration a converted file and an unconverted one may share a
   * widget.
   */
  function ensureCallbackBridge(w: IBaseWidget) {
    const bridged = w as IBaseWidget & { [BRIDGED]?: boolean }
    if (bridged[BRIDGED]) return
    bridged[BRIDGED] = true
    // Tracked here rather than read from the widget at call time. Litegraph
    // assigns `this.value` *before* invoking the callback, so reading it back
    // yields the new value as the old one and every notification is swallowed
    // as a no-op change — which silently killed `on('change')` for real user
    // edits under both renderers.
    lastNotified.set(w, w.value as WidgetValue)
    const original = w.callback
    w.callback = function (this: unknown, value, ...rest) {
      const previous = lastNotified.get(w) as WidgetValue
      lastNotified.set(w, value as WidgetValue)
      original?.apply(this as never, [value, ...rest] as never)
      notify(w, value as WidgetValue, previous)
      // `activate` reports a user act, which a programmatic commit is not.
      if (programmaticWrites > 0) return
      // Otherwise unconditional: a button's value never moves, so gating this
      // on a change would make every button silently dead.
      for (const listener of listeners.get(w)?.activate ?? []) {
        listener(value as WidgetValue)
      }
    } as IBaseWidget['callback']
  }

  /**
   * Installs the two serialization hooks, once per widget.
   *
   * They are separate properties read by separate code paths, which is the
   * same split documented in `WIDGET_SERIALIZATION.md`: `serializeValue` is
   * consulted by `graphToPrompt` when building the API payload, and
   * `serializeWorkflowValue` by `LGraphNode.serialize` when writing the saved
   * file. Installing both is what lets one handler distinguish them by
   * `context` instead of guessing.
   *
   * An earlier `serializeValue` is preserved and treated as the incoming
   * value, so a pack that already substitutes keeps working and this composes
   * on top rather than replacing it.
   */
  function ensureSerializeBridge(w: IBaseWidget) {
    const bridged = w as IBaseWidget & { [SERIALIZE_BRIDGED]?: boolean }
    if (bridged[SERIALIZE_BRIDGED]) return
    bridged[SERIALIZE_BRIDGED] = true

    const original = w.serializeValue
    w.serializeValue = async function (this: unknown, node, index) {
      const base = original
        ? ((await original.apply(this as never, [node, index] as never)) as
            | WidgetValue
            | undefined)
        : (w.value as WidgetValue)
      return serializedValue(w, 'prompt', base as WidgetValue)
    } as IBaseWidget['serializeValue']
    ;(
      w as IBaseWidget & { serializeWorkflowValue?: () => unknown }
    ).serializeWorkflowValue = () =>
      serializedValue(
        w,
        isEmbeddingWorkflow() ? 'embedded' : 'workflow',
        w.value as WidgetValue
      )
  }

  /** Removes a widget and keeps the store's render order in step. */
  function removeWidget(nodeId: string, name: string): boolean {
    const node = resolveNode(nodeId)
    const widget = findWidget(node, name)
    if (!node || !widget) return false
    node.removeWidget(widget)
    for (const listener of listeners.get(widget)?.removed ?? []) listener()
    listeners.delete(widget)
    return true
  }

  return {
    removeWidget,
    handleFor: (nodeId: string, name: string) =>
      factory.handleFor(compositeKey(nodeId, name)) as WidgetHandle,
    liveHandleFor: (nodeId: string, name: string) =>
      factory.liveHandleFor(compositeKey(nodeId, name)) as
        | WidgetHandle
        | undefined,
    prune: () => factory.prune(),
    get cacheSize() {
      return factory.cacheSize
    }
  }
}

/** Marks a widget whose callback has already been bridged to listeners. */
const BRIDGED = Symbol('comfy.widget.bridged')
const SERIALIZE_BRIDGED = Symbol('comfy.widget.serializeBridged')

/**
 * Non-zero while a `setValue` commit is on the stack.
 *
 * Module-scoped rather than per-factory because bridges are per-namespace and
 * chain onto each other: pack A's write must read as programmatic to pack B's
 * bridge too. Dispatch is synchronous, so a plain depth counter is exact — and
 * it makes any commit an activate cascade triggers itself programmatic.
 */
let programmaticWrites = 0

/**
 * A widget whose body the pack renders itself.
 *
 * @knipIgnoreUnusedButUsedByCustomNodes
 */
export interface MountDef {
  readonly name: string
  /**
   * Fills the mounted container. Called once, with an element already attached
   * to the node.
   *
   * `value` holds meaningful serialized state only when `defaultValue` was
   * given. A decorative mount receives the same accessor for one render shape,
   * but should not use it as storage.
   */
  render(container: HTMLElement, value: MountedValue): void
  /** Releases anything `render` retained — listeners, timers, observers. */
  destroy?(): void
  /** Reserved height in graph units. Omit to size to content. */
  readonly height?: number
  /** Set false to keep the element rendered at low zoom. Defaults to true. */
  readonly hideOnZoom?: boolean
  readonly hidden?: boolean
  /**
   * Whether the value is written into the saved workflow.
   *
   * Defaults to `true` when `defaultValue` makes this a value-holding control,
   * and to `false` for a decorative mount.
   */
  readonly serialize?: boolean
  /**
   * Whether the value is sent in the API prompt. Defaults to `serialize`.
   *
   * These are two different flags in litegraph — `widget.serialize` gates the
   * saved workflow, `options.serialize` gates the prompt — and collapsing them
   * into one boolean made two states unsayable. "Saved but not sent" is the
   * one packs need: it is exactly what the legacy
   * `addDOMWidget(…, { serialize: false })` did, and a readout that a node
   * fills in from its own execution result belongs in the workflow but has no
   * business appearing as an input on the next queue.
   *
   * Set it apart from `serialize` only when the two genuinely differ.
   */
  readonly sendToPrompt?: boolean
  /**
   * Makes this a value-holding widget rather than decoration.
   *
   * Without it a mount is a drawing: it can occupy a `widgets_values` slot but
   * has nothing to put in it, so a colour picker or a text box converted onto
   * `mount` kept its position and silently lost what the user typed. Supplying
   * a default gives the widget a real cell, reachable through `render`'s second
   * argument.
   */
  readonly defaultValue?: MountedData
}

/** What a mounted control can hold. @knipIgnoreUnusedButUsedByCustomNodes */
export type MountedData = string | number | boolean | object | null

/**
 * Reading and writing a mounted widget's value.
 *
 * @knipIgnoreUnusedButUsedByCustomNodes
 */
export interface MountedValue {
  get(): MountedData
  set(value: MountedData): void
  /** Notified when the value changed elsewhere — a workflow load. */
  onChange(listener: (value: MountedData) => void): Unsubscribe
}

/**
 * What an omitted `height` falls back to before the container has been laid
 * out. Matches the intrinsic height of a bare `<canvas>`, so the first frame
 * is not a surprise, and the ResizeObserver corrects it as soon as there is a
 * real box to measure.
 */
const DEFAULT_CANVAS_HEIGHT = 150

/**
 * A pointer event on the widget's own canvas, in the same units `draw` uses.
 *
 * @knipIgnoreUnusedButUsedByCustomNodes
 */
export interface CanvasPointerEvent {
  /** Distance from the canvas's left edge, in CSS pixels. */
  readonly x: number
  /** Distance from its top edge, in CSS pixels. */
  readonly y: number
  /** The DOM event, for modifier keys, `button`, and `preventDefault()`. */
  readonly event: PointerEvent
}

/**
 * The colours a pack should draw its own controls in.
 *
 * Published because we told packs to draw. A widget that hardcodes its palette
 * looks wrong the moment the user switches theme, and the alternative — reading
 * `LiteGraph.WIDGET_BGCOLOR` and friends — is a renderer constant we intend to
 * delete. These are the design system's own tokens, resolved from the widget's
 * computed style, so they follow the theme without the pack knowing which one
 * is active.
 *
 * Named by intent rather than by token, because the token names will churn and
 * a pack should not have to follow. Re-read on every draw, so a theme switch
 * needs nothing from the pack.
 *
 * @knipIgnoreUnusedButUsedByCustomNodes
 */
export interface CanvasTheme {
  /** A control's background. */
  readonly surface: string
  /** The same under the pointer. */
  readonly surfaceHovered: string
  /** A control's outline. */
  readonly border: string
  /** A label. */
  readonly text: string
  /** A value, a unit, anything the label outranks. */
  readonly textSecondary: string
}

const THEME_TOKENS: Readonly<Record<keyof CanvasTheme, string>> = {
  surface: '--color-node-component-widget-input-surface',
  surfaceHovered: '--color-node-component-surface-hovered',
  border: '--color-node-component-border',
  text: '--color-text-primary',
  textSecondary: '--color-text-secondary'
}

/**
 * Falls back rather than throwing: a token the design system renames should
 * make a widget slightly wrong, not blank.
 */
function themeOf(element: Element): CanvasTheme {
  const style = getComputedStyle(element)
  const read = (token: string) => style.getPropertyValue(token).trim()
  return Object.freeze({
    surface: read(THEME_TOKENS.surface) || 'transparent',
    surfaceHovered: read(THEME_TOKENS.surfaceHovered) || 'transparent',
    border: read(THEME_TOKENS.border) || 'currentColor',
    text: read(THEME_TOKENS.text) || 'currentColor',
    textSecondary: read(THEME_TOKENS.textSecondary) || 'currentColor'
  })
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface CanvasDef {
  readonly name: string
  /** Reserved height in pixels. Omit to size to the node's width. */
  readonly height?: number
  draw(
    context: CanvasRenderingContext2D,
    size: readonly [number, number],
    theme: CanvasTheme,
    value: MountedValue | undefined
  ): void
  /**
   * The pointer went down on this widget.
   *
   * Coordinates are relative to the canvas and in the same units `draw`
   * receives, so a hit test written against the drawing works unchanged —
   * which is the point. A pack that drew its own controls keeps both the
   * drawing and the hit testing; only the surface changes, from the host's
   * canvas to its own.
   *
   * The primary button is taken: it stops here rather than also reaching the
   * node, or adjusting a slider would drag the node underneath it. Middle and
   * right are left alone, so panning and the context menu still work over the
   * widget.
   *
   * The pointer is captured for the gesture, so a drag that leaves the widget
   * still reports moves and the release.
   */
  onPointerDown?(event: CanvasPointerEvent): void
  /** Moves during a drag, and hover when no button is down. */
  onPointerMove?(event: CanvasPointerEvent): void
  onPointerUp?(event: CanvasPointerEvent): void
  /**
   * The secondary button went down on this widget.
   *
   * Right-click is left alone by {@link onPointerDown} so the node's own
   * context menu keeps working over a widget, which is right by default and
   * wrong for a widget that has its own menu — a lora row wants Move Up, Move
   * Down, Remove. Declaring this claims the gesture: the browser menu is
   * suppressed and the node's does not open.
   */
  onContextMenu?(event: CanvasPointerEvent): void
  /**
   * Makes the surface hold a value rather than only draw one.
   *
   * Without it a drawn control that stores something has to be two widgets — a
   * hidden value widget and a surface — and two widgets cannot occupy the one
   * position the original had. That is not a tidiness point: `serialize` writes
   * at each widget's own index and leaves a hole where a non-serializing widget
   * sits, so the pair has to be ordered value-first to keep the saved array
   * intact, and a pack that gets that wrong writes a null into every workflow
   * the node has ever appeared in. It moved rgthree's Power Puter chip row
   * below its code box.
   *
   * `draw` receives the current value as its fourth argument.
   */
  readonly defaultValue?: MountedData
  /** Whether the value reaches the saved workflow. See {@link MountDef.serialize}. */
  readonly serialize?: boolean
  /** Whether the value reaches the API prompt. See {@link MountDef.sendToPrompt}. */
  readonly sendToPrompt?: boolean
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface CanvasHandle {
  readonly widget: WidgetHandle
  /** Redraws now. Call when the data behind the drawing changed. */
  redraw(): void
}

/** Everything needed to create a widget. */
export interface WidgetDef {
  readonly type: string
  readonly name: string
  readonly value?: WidgetValue
  readonly options?: WidgetOptions
  /** Display-only widgets — replaces the readOnly/opacity DOM fiddling. */
  readonly disabled?: boolean
  readonly hidden?: boolean
  /**
   * Whether the value is written into the saved workflow.
   *
   * Replaces `widget.serializeValue = async () => {}`, the idiom packs use to
   * keep a derived readout out of `widgets_values`. Orthogonal to `hidden`.
   */
  readonly serialize?: boolean
}

export function addDeclaredWidget(
  node: LGraphNode,
  def: WidgetDef
): IBaseWidget {
  const value = 'value' in def ? def.value : ''
  const widget =
    constructDeclaredWidget(node, def.type, def.name, def.options ?? {}, value)
      ?.widget ??
    node.addWidget(
      def.type as never,
      def.name,
      value as never,
      () => {},
      (def.options ?? {}) as never
    )
  if (def.disabled !== undefined) widget.disabled = def.disabled
  if (def.hidden !== undefined) widget.hidden = def.hidden
  if (def.serialize !== undefined) widget.serialize = def.serialize
  return widget
}

export interface WidgetCollection {
  readonly length: number
  get(name: string): WidgetHandle | undefined
  at(index: number): WidgetHandle | undefined
  all(): readonly WidgetHandle[]
  names(): readonly string[]
  /**
   * Replaces splice/assign reordering. `names` must be a permutation of the
   * current names — a partial list throws rather than silently dropping
   * widgets, which is how the array-splice idiom lost them.
   */
  reorder(names: readonly string[]): void
  move(name: string, toIndex: number): void
  /**
   * Creates a widget on this node.
   *
   * The counterpart to `remove` — packs that rebuild a readout widget do
   * remove-then-create, and without this only half the operation has a
   * destination, which makes the conversion cosmetic.
   */
  add(def: WidgetDef): WidgetHandle
  /**
   * Mounts an element on the node and hands it to the pack to fill.
   *
   * The replacement for `addDOMWidget`, and the destination for hand-painted
   * canvas controls. Across kjnodes' canvas editors the drawing is rectangles,
   * images, straight lines and text — all DOM primitives — but a pack that
   * wants to keep its existing `ctx` code can append a `<canvas>` to the
   * container and carry it over unchanged.
   *
   * The gain is not the drawing, it is the input: these editors hand-roll
   * hit-testing against bounding boxes because canvas gives them nothing to
   * attach a listener to. Mounted in the DOM, pointer events land on the
   * element and most of that code goes away.
   */
  mount(def: MountDef): WidgetHandle
  /**
   * A per-node drawing surface, and the destination for `onDrawForeground`.
   *
   * Works under both renderers without the pack knowing which it is on: the
   * canvas is a DOM element, which the legacy renderer positions over the
   * graph canvas and Nodes 2.0 renders directly. That is the whole reason it
   * is a mounted element rather than a hook into the graph's own context —
   * drawing into the shared context is what ties a pack to the old renderer.
   *
   * `draw` is called on mount, on resize, and whenever `redraw()` is called.
   */
  canvas(def: CanvasDef): CanvasHandle
  remove(name: string): boolean
  [Symbol.iterator](): Iterator<WidgetHandle>
}

/**
 * Nodes 2.0 renders from the store's widget order, not the array, so a reorder
 * that only touches the array is invisible there. `removeWidget` already syncs
 * internally; reorder must do it explicitly.
 */
function syncWidgetOrder(node: LGraphNode): void {
  const graphId = node.graph?.rootGraph.id
  if (!graphId || !node.widgets) return
  useWidgetValueStore().setNodeWidgetOrder(
    graphId,
    node.id,
    getWidgetIds(node.widgets)
  )
}

export function createWidgetCollection(
  getNode: () => LGraphNode | undefined,
  handles: ReturnType<typeof createWidgetHandles>,
  nodeId: string
): WidgetCollection {
  const widgets = () => getNode()?.widgets ?? []
  const handleAt = (index: number) => {
    const w = widgets()[index]
    return w ? handles.handleFor(nodeId, w.name) : undefined
  }

  const collection: WidgetCollection = {
    get length() {
      return widgets().length
    },
    get: (name) =>
      widgets().some((w) => w.name === name)
        ? handles.handleFor(nodeId, name)
        : undefined,
    at: handleAt,
    all: () =>
      Object.freeze(widgets().map((w) => handles.handleFor(nodeId, w.name))),
    names: () => Object.freeze(widgets().map((w) => w.name)),

    reorder(names) {
      const node = getNode()
      const current = node?.widgets
      if (!current) return

      const existing = current.map((w) => w.name)
      const missing = existing.filter((n) => !names.includes(n))
      const unknown = names.filter((n) => !existing.includes(n))
      if (
        missing.length ||
        unknown.length ||
        names.length !== existing.length
      ) {
        throw new ComfyApiError(
          `reorder() needs every widget name exactly once. ` +
            (missing.length ? `Missing: ${missing.join(', ')}. ` : '') +
            (unknown.length ? `Unknown: ${unknown.join(', ')}.` : '')
        )
      }

      const byName = new Map(current.map((w) => [w.name, w]))
      // Mutate in place: assigning a new array drops the renderer's tracking.
      current.splice(
        0,
        current.length,
        ...names.map((n) => byName.get(n) as IBaseWidget)
      )
      syncWidgetOrder(node)
    },

    move(name, toIndex) {
      const order = [...collection.names()]
      const from = order.indexOf(name)
      if (from === -1) {
        throw new ComfyApiError(`No widget named '${name}' on this node.`)
      }
      const clamped = Math.max(0, Math.min(toIndex, order.length - 1))
      order.splice(clamped, 0, ...order.splice(from, 1))
      collection.reorder(order)
    },

    add(def) {
      const node = getNode()
      if (!node) {
        throw new ComfyApiError(
          `Cannot add widget '${def.name}': the node no longer exists.`
        )
      }
      if (node.widgets?.some((w) => w.name === def.name)) {
        throw new ComfyApiError(
          `A widget named '${def.name}' already exists on this node. ` +
            `Remove it first, or use setOptions to change it.`
        )
      }

      addDeclaredWidget(node, def)

      syncWidgetOrder(node)
      return handles.handleFor(nodeId, def.name)
    },

    mount(def) {
      const node = getNode()
      if (!node) {
        throw new ComfyApiError(
          `Cannot mount '${def.name}': the node no longer exists.`
        )
      }
      if (node.widgets?.some((w) => w.name === def.name)) {
        throw new ComfyApiError(
          `A widget named '${def.name}' already exists on this node.`
        )
      }

      if (typeof node.addDOMWidget !== 'function') {
        throw new ComfyApiError(
          `Cannot mount '${def.name}': DOM widgets are unavailable in this ` +
            `host. This needs a browser environment with the widget layer loaded.`
        )
      }

      const container = document.createElement('div')
      container.style.width = '100%'
      if (def.height !== undefined) container.style.height = `${def.height}px`

      // A cell only when the pack asked for one. Decoration stays valueless,
      // which is what keeps a drawing out of the wire format; a control that
      // declares a default gets somewhere to keep what the user enters.
      const holdsValue = def.defaultValue !== undefined
      // Copied, not shared: `mount` is called per node, but a pack commonly
      // hoists one default object and passes it every time. A control that
      // edits its value in place would then edit every node's at once.
      let current: MountedData =
        typeof def.defaultValue === 'object' && def.defaultValue !== null
          ? structuredClone(def.defaultValue)
          : (def.defaultValue ?? '')
      const widget = node.addDOMWidget(def.name, 'custom', container, {
        // Mounted widgets carry no value, so they stay out of widgets_values
        // unless the pack says otherwise — the wire format must not change
        // because a pack drew something.
        // A control that holds a value is saved and sent by default; a
        // drawing is not. Either way the pack's own choice wins.
        serialize: def.sendToPrompt ?? def.serialize ?? holdsValue,
        hideOnZoom: def.hideOnZoom ?? true,
        ...(holdsValue
          ? {
              getValue: () => current,
              setValue: (value: unknown) => {
                current = value as MountedData
              }
            }
          : {})
      } as never)
      // Also on the widget: `options.serialize` gates the API prompt, while
      // the widget's own flag gates workflow persistence, and a drawing must
      // stay out of both.
      widget.serialize = def.serialize ?? holdsValue
      // Teardown matters more here than for a plain widget: a mounted element
      // owns listeners, timers and observers that the node's removal would
      // otherwise leave running.
      //
      // Chained, never assigned: `onRemove` is a method on DOMWidgetImpl that
      // unregisters the widget from the DOM widget store, and an own property
      // shadows it — leaking every mounted widget for the life of the page.
      if (def.destroy) {
        const previous = widget.onRemove
        widget.onRemove = function (this: unknown) {
          previous?.call(this)
          def.destroy?.()
        }
      }
      if (def.hidden !== undefined) widget.hidden = def.hidden

      const changeListeners = new Set<(value: MountedData) => void>()
      if (holdsValue) {
        const previousCallback = widget.callback
        widget.callback = function (this: unknown, value, ...rest) {
          previousCallback?.apply(this as never, [value, ...rest] as never)
          for (const listener of changeListeners) listener(value as MountedData)
        } as IBaseWidget['callback']
      }

      def.render(container, {
        get: () => widget.value as MountedData,
        // The widget's own setter stores through `setValue` and then fires the
        // callback, so notifying here as well would report twice.
        set: (value) => {
          widget.value = value as never
        },
        onChange: (listener) => {
          changeListeners.add(listener)
          return () => changeListeners.delete(listener)
        }
      })
      syncWidgetOrder(node)
      return handles.handleFor(nodeId, def.name)
    },

    canvas(def) {
      const element = document.createElement('canvas')
      // Captured from `render` rather than read per draw: `mount` hands the
      // accessor over once, and a draw that happens before mounting has nothing
      // to read anyway.
      let held: MountedValue | undefined
      element.style.width = '100%'
      element.style.display = 'block'

      let observer: ResizeObserver | undefined
      const redraw = () => {
        const context = element.getContext('2d')
        if (!context) return
        // Match the backing store to the displayed size, or the drawing is
        // blurry on a high-density display and misaligned after a resize.
        const ratio = globalThis.devicePixelRatio ?? 1
        const width = element.clientWidth || 1
        // From the container, never from the element: a <canvas> with no CSS
        // height lays out at its height ATTRIBUTE, which is the scaled backing
        // store. Reading its own clientHeight back would multiply by the ratio
        // again on every pass, and the ResizeObserver below would keep firing.
        const height =
          def.height ??
          element.parentElement?.clientHeight ??
          DEFAULT_CANVAS_HEIGHT
        // The CSS size is the reserved height in CSS pixels; only the backing
        // store is scaled. Setting one without the other is what made a widget
        // render `ratio` times too tall.
        element.style.height = `${height}px`
        element.width = Math.round(width * ratio)
        element.height = Math.round(height * ratio)
        context.setTransform(ratio, 0, 0, ratio, 0, 0)
        context.clearRect(0, 0, width, height)
        def.draw(
          context,
          Object.freeze([width, height] as const),
          themeOf(element),
          held
        )
      }

      const at = (event: PointerEvent): CanvasPointerEvent => {
        const rect = element.getBoundingClientRect()
        return Object.freeze({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          event
        })
      }
      const wantsPointer =
        !!def.onPointerDown || !!def.onPointerMove || !!def.onPointerUp
      const onContextMenu = (event: MouseEvent) => {
        // Both, and neither is redundant: preventDefault stops the browser
        // menu, stopPropagation stops the canvas opening the node's.
        event.preventDefault()
        event.stopPropagation()
        def.onContextMenu?.(at(event as unknown as PointerEvent))
      }
      const onDown = (event: PointerEvent) => {
        // Only the primary button. Middle and right belong to panning and the
        // context menu, which still have to work over the widget.
        if (event.button !== 0) return
        event.stopPropagation()
        element.setPointerCapture(event.pointerId)
        def.onPointerDown?.(at(event))
      }
      const onMove = (event: PointerEvent) => def.onPointerMove?.(at(event))
      const onUp = (event: PointerEvent) => {
        if (element.hasPointerCapture(event.pointerId)) {
          element.releasePointerCapture(event.pointerId)
        }
        def.onPointerUp?.(at(event))
      }

      const widget = this.mount({
        name: def.name,
        height: def.height,
        defaultValue: def.defaultValue,
        serialize: def.serialize,
        sendToPrompt: def.sendToPrompt,
        render: (container, value) => {
          held = value
          container.append(element)
          // A value changed elsewhere — a workflow load — has to reach the
          // drawing, which has no other way to notice.
          value?.onChange?.(() => redraw())
          redraw()
          if (wantsPointer) {
            element.addEventListener('pointerdown', onDown)
            element.addEventListener('pointermove', onMove)
            element.addEventListener('pointerup', onUp)
          }
          if (def.onContextMenu) {
            element.addEventListener('contextmenu', onContextMenu)
          }
          // Redraw on resize rather than per frame: these drawings change when
          // the node changes, not sixty times a second.
          observer = new ResizeObserver(redraw)
          observer.observe(container)
        },
        destroy: () => {
          observer?.disconnect()
          observer = undefined
          element.removeEventListener('pointerdown', onDown)
          element.removeEventListener('pointermove', onMove)
          element.removeEventListener('pointerup', onUp)
          element.removeEventListener('contextmenu', onContextMenu)
        }
      })
      return { widget, redraw }
    },

    remove: (name) => handles.removeWidget(nodeId, name),

    *[Symbol.iterator]() {
      for (let i = 0; i < widgets().length; i++) {
        const handle = handleAt(i)
        if (handle) yield handle
      }
    }
  }

  return Object.freeze(collection)
}
