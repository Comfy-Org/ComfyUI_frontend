import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
type UUID = string

/**
 * A widget's canonical identity: `graphId:nodeId:name`.
 * Duplicate widget names must be normalized before deriving this ID.
 * See ADR-ECS-0008's "Widget identity keys on name" section.
 */
export type WidgetId = string & { readonly __brand: 'WidgetId' }

const SEPARATOR = ':'
const WIDGET_ID_PATTERN = /^(?<graphId>[^:]+):(?<nodeId>[^:]+):(?<name>[^:]+)$/u

export function widgetId(
  graphId: UUID,
  localNodeId: NodeId,
  name: string
): WidgetId {
  return [
    graphId,
    encodeURIComponent(String(localNodeId)),
    encodeURIComponent(name)
  ].join(SEPARATOR) as WidgetId
}

/**
 * Whether `name` can be written on {@link widget} at all: a structural property
 * of the object, not of whether a particular write landed. Both the rename gate
 * and the removal criterion read it, deliberately, so the two cannot disagree
 * about the same widget.
 */
function nameIsWritable(widget: { name: string }): boolean {
  try {
    // The whole chain: `BaseWidget` declares `name` as a class accessor, so an
    // instance has no own descriptor and would fall through to extensibility,
    // which answers whether properties can be *added*. That reads "writable"
    // for an inherited getter with no setter, which is unaddressable.
    for (
      let target: object | null = widget;
      target;
      target = Reflect.getPrototypeOf(target)
    ) {
      const descriptor = Object.getOwnPropertyDescriptor(target, 'name')
      if (!descriptor) continue
      return 'writable' in descriptor ? !!descriptor.writable : !!descriptor.set
    }
    // Nothing on the chain defines `name`, so a write would create it.
    return Object.isExtensible(widget)
  } catch {
    // Every call above runs a proxy trap, mid-walk inside `LGraph.add`. A
    // widget whose traps throw is exactly what removal is for, so answer here
    // rather than abort the walk with the node half-attached.
    return false
  }
}

/**
 * The key {@link widget}'s current `name` would build an id from, or
 * `undefined` when no id can be derived from it at all.
 *
 * Asks nothing about ownership — {@link ownedWidgetNameKey} is that question.
 * This exists for the one caller that can answer ownership better than an array
 * position can: a widget already bound to the store entry at an id owns that id
 * wherever it sits, including off the node entirely.
 */
export function widgetNameKey(widget: { name: string }): string | undefined {
  const key = readName(widget)
  return key === UNREADABLE_NAME ? undefined : key
}

/**
 * The key {@link widget} may mint a {@link WidgetId} from on a node whose
 * widgets are {@link widgets}, or `undefined` when an *earlier* widget in the
 * array already holds that name — or when the array does not hold
 * {@link widget} at all, which is a node that does not list it.
 *
 * Per widget, where {@link ensureUniqueWidgetNames} answers a whole-node
 * question. A node still carrying an ambiguous pair after every rename was
 * attempted has one widget per name that may own the identity — the first to
 * hold it — so gating registration on the whole-node answer withholds an id
 * from every widget on the node, including widgets that collide with nothing.
 * A Vue node draws from the registered order (`getNodeWidgetIds`), so it then
 * draws nothing. The invariant is unchanged either way: one name still resolves
 * to one id held by one widget, and the later duplicate still registers
 * nothing. Only the collateral loss goes away (ADR-ECS-0008).
 *
 * Returns the key rather than a boolean so the caller mints from the value this
 * answer was computed on: an accessor that answers differently on a second read
 * cannot pass under one name and mint under another, and one that throws
 * answers `undefined` here instead of escaping the `widgetId` getter.
 *
 * Names are compared as {@link readName} keys, not raw values, so a widget
 * named `1` and one named `'1'` are one identity — the same reading
 * {@link dropUnrenamableDuplicateWidgets} uses to decide which widget is the
 * duplicate. {@link ensureUniqueWidgetNames} still compares raw values and
 * calls that pair unambiguous, which is FE-3036's keying question and not this
 * gate's; the disagreement is safe in this direction only, because this
 * withholds an id and never removes a widget.
 */
export function ownedWidgetNameKey(
  widgets: readonly { name: string }[],
  widget: { name: string }
): string | undefined {
  const key = readName(widget)
  if (key === UNREADABLE_NAME) return undefined

  for (const candidate of widgets) {
    // Reached this widget without an earlier holder, so the name is its own.
    // Identity, not position: the same object may transiently occupy two
    // slots during an index-assignment reorder, and that is one widget.
    if (candidate === widget) return key
    // An unreadable candidate answers `UNREADABLE_NAME`, which is never equal
    // to a key, so it is skipped rather than blocking this widget.
    if (readName(candidate) === key) return undefined
  }

  // Not on the array at all, so the node does not list it and it may not take
  // an identity on that node. Answering with the key here would fail open: a
  // widget that was never this node's would be granted the right to mint an id
  // on it, which is the write `LGraphNode.addWidget` already refuses by hand
  // ("Registering one the node no longer has would write over the widget that
  // kept the name").
  //
  // A widget that is bound to an entry keeps answering with it — but that is a
  // different question, asked of the store rather than of the array, and
  // `BaseWidget.boundWidgetId` is where it is answered. `dynamicWidgets.ts`
  // depends on that: it splices a group's widgets off `node.widgets` and *then*
  // reads `widget.widgetId` to delete each store entry (`updateWidgets`, and
  // again when an input is removed), so an unconditional `undefined` would leak
  // every one of those entries and a later widget of the same name and type
  // would inherit the stale value — the #13073 family.
  return undefined
}

export function ensureUniqueWidgetNames(
  widgets: readonly { name: string }[]
): boolean {
  try {
    const reserved = new Set(widgets.map(({ name }) => name))
    const used = new Set<string>()
    const seen = new Set<unknown>()
    const renames: { widget: { name: string }; name: string }[] = []

    for (const widget of widgets) {
      // The same widget object may transiently occupy multiple array slots
      // (e.g. during an index-assignment reorder). Identity duplicates are
      // one widget, not a name collision — never rename them.
      if (seen.has(widget)) continue
      seen.add(widget)
      if (!used.has(widget.name)) {
        used.add(widget.name)
        continue
      }

      let index = 1
      while (
        used.has(`${widget.name}#${index}`) ||
        reserved.has(`${widget.name}#${index}`)
      ) {
        index++
      }
      const name = `${widget.name}#${index}`
      used.add(name)
      renames.push({ widget, name })
    }

    if (renames.some(({ widget }) => !nameIsWritable(widget))) {
      console.warn('Cannot safely rename duplicate widgets')
      return false
    }

    // Read back, because a `true` over a node that still carries one name
    // twice reports it unambiguous to the callers that act on that answer
    // (`litegraphUtil`'s widget-value sync). It no longer decides whether a
    // widget may register — that is per widget, and {@link ownedWidgetNameKey}
    // answers it. Every rename is attempted first, so one declined write does
    // not strand the collisions that would have resolved.
    let unique = true
    for (const { widget, name } of renames) {
      try {
        widget.name = name
        if (widget.name !== name) unique = false
      } catch {
        unique = false
      }
    }
    return unique
  } catch (error) {
    console.warn('Failed to rename duplicate widgets', error)
    return false
  }
}

/**
 * A `name` from which no identity can be derived — the accessor threw, the
 * value would not coerce to a string, or the result is not something
 * {@link widgetId} can encode. Distinct from a widget whose name *is*
 * `undefined`: that one has an identity, a bad one, and two of them collide
 * with each other.
 */
const UNREADABLE_NAME = Symbol('unreadable widget name')

/**
 * Why a widget could not be given a unique name on its node.
 *
 * `unresolved-duplicate` is the one cause that does **not** remove the widget:
 * the rename did not land, but the write was structurally possible, so the
 * failure is recoverable and losing the widget would be worse than carrying
 * the ambiguity. See {@link nameIsWritable}.
 */
type WidgetRefusalCause =
  | 'unreadable-name'
  | 'duplicate-name'
  | 'unresolved-duplicate'

/**
 * A widget the walk could not name uniquely. The cause and the name come from
 * the walk rather than from another read of the accessor: a hostile one need
 * not answer twice the same way, and the walk may have written to it.
 */
export interface RefusedWidget<T> {
  widget: T
  cause: WidgetRefusalCause
  /** Whether the walk removed {@link widget} from the array it was given. */
  removed: boolean
  /** The key the walk read, or `undefined` when no key could be derived. */
  name: string | undefined
}

/**
 * The identity key `name` claims, or {@link UNREADABLE_NAME}. It is the key
 * rather than the raw value because `widgetId` keys on
 * `encodeURIComponent(String(name))`, so names that differ as values and
 * coincide as strings are one identity and have to collide here.
 *
 * An empty name is deliberately readable: it mints an id the store declines to
 * key on, which costs the widget nothing, and `addWidget('text', '', …)` is an
 * ordinary unlabeled widget that node packs ship (ADR-ECS-0008).
 */
function readName(widget: { name: string }): string | typeof UNREADABLE_NAME {
  try {
    const raw: unknown = widget.name
    const key = String(raw)
    // The raw value, as `widgetId` encodes it: a Symbol survives `String()`
    // and throws here.
    encodeURIComponent(raw as string)
    return key
  } catch {
    return UNREADABLE_NAME
  }
}

/** @returns whether {@link widget} now answers to {@link name}. */
function tryRename(widget: { name: string }, name: string): boolean {
  try {
    widget.name = name
    // A setter is free to ignore the write, and only a read proves it did not.
    return widget.name === name
  } catch {
    return false
  }
}

/** Whether no identity key can be read from {@link widget}'s `name`. */
export function isWidgetNameUnreadable(widget: { name: string }): boolean {
  return readName(widget) === UNREADABLE_NAME
}

/** Every name key the array already holds outright, skipping unreadable ones. */
function readableNames(widgets: readonly { name: string }[]): Set<string> {
  const names = new Set<string>()
  for (const widget of widgets) {
    const name = readName(widget)
    if (name !== UNREADABLE_NAME) names.add(name)
  }
  return names
}

/**
 * The first `name#n` no set in {@link taken} claims — so a generated name never
 * collides with one a widget further down the array holds outright.
 */
function freeSuffixedName(
  name: string,
  taken: readonly ReadonlySet<string>[]
): string {
  let index = 1
  while (taken.some((names) => names.has(`${name}#${index}`))) index++
  return `${name}#${index}`
}

/**
 * How many names a colliding widget is offered before the pair is reported
 * unresolved. More than one, because `BaseWidget`'s setter declines a move onto
 * an id the store already holds, so one stale entry can reject a candidate the
 * widget would otherwise take.
 */
const RENAME_ATTEMPTS = 4

/**
 * Renames {@link widget} to the first free `name#n` that the write actually
 * takes, setting aside each candidate the setter rejects so the next attempt
 * offers a different one.
 *
 * @returns the name it now answers to, or `undefined` if no attempt stuck.
 */
function renameApart(
  widget: { name: string },
  name: string,
  used: ReadonlySet<string>,
  reserved: ReadonlySet<string>
): string | undefined {
  // Rejected candidates are tracked per widget, not reserved globally: a name
  // this widget's setter would not take is still free for the next widget.
  const rejected = new Set<string>()
  for (let attempt = 0; attempt < RENAME_ATTEMPTS; attempt++) {
    const candidate = freeSuffixedName(name, [used, reserved, rejected])
    if (tryRename(widget, candidate)) return candidate
    rejected.add(candidate)
  }
  return undefined
}

/**
 * Renamed apart and kept, kept but reported, or refused. Adds to
 * `used`/`reserved` when an attempt sticks.
 *
 * A rename that did not land is not proof of an unaddressable widget, so
 * {@link nameIsWritable} decides removal and the unresolved pair is reported
 * instead (ADR-ECS-0008).
 */
function resolveCollision(
  widget: { name: string },
  key: string,
  used: Set<string>,
  reserved: Set<string>
): { keep: boolean; cause?: WidgetRefusalCause } {
  const unique = renameApart(widget, key, used, reserved)
  if (unique !== undefined) {
    used.add(unique)
    reserved.add(unique)
    return { keep: true }
  }
  if (nameIsWritable(widget)) {
    return { keep: true, cause: 'unresolved-duplicate' }
  }
  return { keep: false, cause: 'duplicate-name' }
}

/**
 * Renames the duplicates it can, removes the ones it cannot address at all,
 * and keeps the first occurrence of each name either way. Mutates
 * {@link widgets} in place. The invariant and the remove-or-keep criterion are
 * ADR-ECS-0008's, under "Widget identity keys on `name`".
 *
 * Unlike {@link ensureUniqueWidgetNames} this reads each write back, so a
 * setter that accepts and ignores it cannot report success, and a widget it
 * cannot rename does not strand the collisions that would have resolved.
 *
 * @returns every widget it could not name uniquely, with the cause and whether
 * it was removed, in array order.
 */
export function dropUnrenamableDuplicateWidgets<T extends { name: string }>(
  widgets: T[]
): RefusedWidget<T>[] {
  const kept: T[] = []
  const refused: RefusedWidget<T>[] = []
  const used = new Set<string>()
  const reserved = readableNames(widgets)
  /** Every widget already walked, against whether that walk kept it. */
  const verdicts = new Map<T, boolean>()

  for (const widget of widgets) {
    // The same widget object may occupy a second slot mid-reorder. That is one
    // widget, not a collision — but it has to follow the verdict its first
    // occurrence got, or a refused widget is re-admitted by its own repeat.
    const previous = verdicts.get(widget)
    if (previous !== undefined) {
      if (previous) kept.push(widget)
      continue
    }

    const name = readName(widget)
    if (name === UNREADABLE_NAME) {
      verdicts.set(widget, false)
      refused.push({
        widget,
        cause: 'unreadable-name',
        removed: true,
        name: undefined
      })
      continue
    }

    // `readName` already returned the key, not the raw value.
    const key = name
    if (!used.has(key)) {
      used.add(key)
      verdicts.set(widget, true)
      kept.push(widget)
      continue
    }

    const outcome = resolveCollision(widget, key, used, reserved)
    verdicts.set(widget, outcome.keep)
    if (outcome.keep) kept.push(widget)
    if (outcome.cause) {
      // `key`, not a re-read: the walk may have written to the name since.
      refused.push({
        widget,
        cause: outcome.cause,
        removed: !outcome.keep,
        name: key
      })
    }
  }

  if (refused.length) widgets.splice(0, widgets.length, ...kept)
  return refused
}

function decodeWidgetIdSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch (error) {
    if (error instanceof URIError) return segment
    throw error
  }
}

export function parseWidgetId(id: WidgetId): {
  graphId: UUID
  nodeId: NodeId
  name: string
} {
  const groups = WIDGET_ID_PATTERN.exec(id)?.groups
  if (!groups) throw new Error('Invalid widget id')

  return {
    graphId: groups.graphId,
    nodeId: toNodeId(decodeWidgetIdSegment(groups.nodeId)),
    name: decodeWidgetIdSegment(groups.name)
  }
}

export function isWidgetId(value: unknown): value is WidgetId {
  if (typeof value !== 'string') return false
  return WIDGET_ID_PATTERN.test(value)
}
