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
function nameIsWritable(widget: object): boolean {
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

    // Read back, because `setNodeId` and `widgetId` bail on this answer: a
    // `true` over a node that still carries one name twice is what lets a
    // colliding id be registered. Every rename is attempted first, so one
    // declined write does not strand the collisions that would have resolved.
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

/**
 * A widget the walk could not name uniquely. The cause and the name come from
 * the walk rather than from another read of the accessor: a hostile one need
 * not answer twice the same way, and the walk may have written to it.
 */
export type RefusedWidget<T> =
  | { widget: T; cause: 'unreadable-name'; name: undefined }
  | { widget: T; cause: 'duplicate-name'; name: string }
  | { widget: T; cause: 'unresolved-duplicate'; name: string }

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

/** Whether no identity key can be read from {@link widget}'s `name`. */
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

/**
 * Renamed apart and kept, kept but reported, or refused. Adds to
 * `used`/`reserved` when the rename sticks.
 *
 * A rename that did not land is not proof of an unaddressable widget, so
 * {@link nameIsWritable} decides removal and the unresolved pair is reported
 * instead (ADR-ECS-0008).
 */
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
 * @param isNameTaken whether a candidate name is already held outside
 * {@link widgets}, such as by a store entry the rename would be refused onto.
 * @returns every widget it could not name uniquely, with the cause, in array
 * order. Every cause but `unresolved-duplicate` was removed.
 */
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
    // `key`, not a re-read: the walk may have written to the name since.
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
