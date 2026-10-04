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
 * Whether `name` can be written on {@link widget} at all — a structural
 * property of the object, not of whether a particular write landed.
 *
 * This is the criterion {@link ensureUniqueWidgetNames} uses to decide whether
 * it may rename at all, and it is deliberately the same one
 * {@link dropUnrenamableDuplicateWidgets} uses to decide whether a rename that
 * failed is fatal. The two must agree: one walk removing a widget the other
 * calls renamable would be destroying widgets over a disagreement between two
 * copies of one rule.
 */
function nameIsWritable(widget: { name: string }): boolean {
  try {
    for (
      let target: object | null = widget;
      target;
      target = Reflect.getPrototypeOf(target)
    ) {
      const descriptor = Object.getOwnPropertyDescriptor(target, 'name')
      if (!descriptor) continue
      return 'writable' in descriptor ? !!descriptor.writable : !!descriptor.set
    }
    return Object.isExtensible(widget)
  } catch {
    return false
  }
}

/**
 * Whether {@link widget} may mint an id for the name it currently holds on a
 * node whose widgets are {@link widgets} — true unless an *earlier* widget in
 * the array already holds that name.
 *
 * This is deliberately a per-widget question, and
 * {@link ensureUniqueWidgetNames} answers a different, whole-node one. A node
 * that still carries an ambiguous pair after every rename was attempted has
 * exactly one widget per name that may own the identity: the first to hold it.
 * Gating registration on the whole-node answer instead withholds an id from
 * *every* widget on the node, including widgets that share a name with nothing
 * — so one unresolvable pair erases the node's entire widget order, and a Vue
 * node renders no widgets at all (`getNodeWidgetIds` is what it draws from).
 *
 * The identity invariant is unchanged by answering per widget: one name still
 * resolves to one {@link WidgetId} held by one widget, so a later duplicate is
 * never registered and can never be handed the first widget's state. It is the
 * collateral loss that goes away.
 *
 * Every read of another widget's `name` is guarded. A widget whose accessor
 * throws is refused in its own right by {@link dropUnrenamableDuplicateWidgets}
 * and must not also decide whether an unrelated widget has an identity.
 */
export function widgetOwnsItsName(
  widgets: readonly { name: string }[],
  widget: { name: string }
): boolean {
  let name: string
  try {
    name = widget.name
  } catch {
    // No name read, no id. This is the `unreadable-name` refusal's own case.
    return false
  }

  for (const candidate of widgets) {
    // Reached this widget without an earlier holder, so the name is its own.
    // Identity, not position: the same object may transiently occupy two
    // slots during an index-assignment reorder, and that is one widget.
    if (candidate === widget) return true
    try {
      if (candidate.name === name) return false
    } catch {
      continue
    }
  }

  // Not on the array at all, and no widget on it holds this name. A widget the
  // refusal walk removed falls out of the loop above instead: it shares its
  // name with whichever widget kept it, so it has no identity of its own to
  // read or write through, and that is the point.
  return true
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

    // The write is read back, and a write that did not land makes this `false`.
    //
    // An unconditional `true` reported success over a node that still carries
    // two widgets under one name. `BaseWidget`'s own `name` setter declines
    // the write whenever the store declines the move — which is exactly the
    // state `dropUnrenamableDuplicateWidgets` leaves behind when it keeps an
    // unresolved duplicate rather than deleting the user's widget — so this
    // answered "unambiguous" precisely where it was wrong, and the callers
    // that act on it (`litegraphUtil`'s widget-value sync) acted on that.
    //
    // It is no longer what decides whether a widget may be registered: that is
    // per widget, and {@link widgetOwnsItsName} answers it.
    //
    // Every rename is still attempted before answering: one declined write
    // must not strand the collisions that would have resolved cleanly.
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

const UNREADABLE_NAME = Symbol('unreadable widget name')

export type RefusedWidget<T> =
  | { widget: T; cause: 'unreadable-name'; name: undefined }
  | { widget: T; cause: 'duplicate-name'; name: string }
  | { widget: T; cause: 'unresolved-duplicate'; name: string }

function readName(widget: { name: unknown }): string | typeof UNREADABLE_NAME {
  try {
    const raw = widget.name
    if (typeof raw === 'symbol') return UNREADABLE_NAME
    const key = String(raw)
    encodeURIComponent(key)
    return key
  } catch {
    return UNREADABLE_NAME
  }
}

function tryRename(widget: { name: unknown }, name: string): boolean {
  try {
    widget.name = name
    return widget.name === name
  } catch {
    return false
  }
}

export function isWidgetNameUnreadable(widget: { name: unknown }): boolean {
  return readName(widget) === UNREADABLE_NAME
}

function readableNames(widgets: readonly { name: unknown }[]): Set<string> {
  const names = new Set<string>()
  for (const widget of widgets) {
    const name = readName(widget)
    if (name !== UNREADABLE_NAME) names.add(name)
  }
  return names
}

function freeSuffixedName(
  name: string,
  isTaken: (candidate: string) => boolean
): string {
  let index = 1
  while (isTaken(`${name}#${index}`)) index++
  return `${name}#${index}`
}

function resolveCollision(
  widget: { name: unknown },
  key: string,
  used: Set<string>,
  reserved: Set<string>,
  isNameTaken: (name: string) => boolean
): 'renamed' | 'unresolved-duplicate' | 'duplicate-name' {
  const candidate = freeSuffixedName(
    key,
    (name) => used.has(name) || reserved.has(name) || isNameTaken(name)
  )
  if (tryRename(widget, candidate)) {
    used.add(candidate)
    reserved.add(candidate)
    return 'renamed'
  }
  return nameIsWritable(widget) ? 'unresolved-duplicate' : 'duplicate-name'
}

export function dropUnrenamableDuplicateWidgets<T extends { name: unknown }>(
  widgets: T[],
  isNameTaken: (name: string) => boolean = () => false
): RefusedWidget<T>[] {
  const kept: T[] = []
  const refused: RefusedWidget<T>[] = []
  const used = new Set<string>()
  const reserved = readableNames(widgets)
  const verdicts = new Map<T, boolean>()

  for (const widget of widgets) {
    const previous = verdicts.get(widget)
    if (previous !== undefined) {
      if (previous) kept.push(widget)
      continue
    }

    const key = readName(widget)
    if (key === UNREADABLE_NAME) {
      verdicts.set(widget, false)
      refused.push({ widget, cause: 'unreadable-name', name: undefined })
      continue
    }

    if (!used.has(key)) {
      used.add(key)
      verdicts.set(widget, true)
      kept.push(widget)
      continue
    }

    const outcome = resolveCollision(widget, key, used, reserved, isNameTaken)
    const keep = outcome !== 'duplicate-name'
    verdicts.set(widget, keep)
    if (keep) kept.push(widget)
    if (outcome !== 'renamed')
      refused.push({ widget, cause: outcome, name: key })
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
