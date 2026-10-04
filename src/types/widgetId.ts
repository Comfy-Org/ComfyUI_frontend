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

    if (
      renames.some(({ widget }) => {
        const descriptor = Object.getOwnPropertyDescriptor(widget, 'name')
        return descriptor
          ? 'writable' in descriptor
            ? !descriptor.writable
            : !descriptor.set
          : !Object.isExtensible(widget)
      })
    ) {
      console.warn('Cannot safely rename duplicate widgets')
      return false
    }

    for (const { widget, name } of renames) widget.name = name
    return true
  } catch (error) {
    console.warn('Failed to rename duplicate widgets', error)
    return false
  }
}

/**
 * Reads `name` without letting a throwing accessor escape. A widget whose
 * `name` cannot be read has no identity to collide with, so it is left alone.
 */
function readName(widget: { name: string }): string | undefined {
  try {
    return widget.name
  } catch {
    return undefined
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

/** Every name the array already holds outright, skipping unreadable ones. */
function readableNames(widgets: readonly { name: string }[]): Set<string> {
  const names = new Set<string>()
  for (const widget of widgets) {
    const name = readName(widget)
    if (name !== undefined) names.add(name)
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
 * Removes the widgets that cannot be given a unique name, mutating
 * {@link widgets} in place, and renames the duplicates that can — keeping the
 * first occurrence of each name either way.
 *
 * `WidgetId` is `graphId:nodeId:name`, so a second widget under a name another
 * widget already holds is not a second identity — it is the same identity
 * twice. ADR-ECS-0008's "Widget identity keys on `name`" records that as an
 * invariant rather than a limitation to work around:
 * **two widgets on one node cannot share a name.**
 *
 * {@link ensureUniqueWidgetNames} normally keeps that true by renaming the
 * later occurrence to `name#1`. It cannot when that widget's `name` is not
 * writable, or when an accessor throws — and because it is all-or-nothing, one
 * such widget also leaves every *renamable* collision on the node standing.
 * This walk renames those and refuses only what is genuinely unaddressable: a
 * widget the store cannot tell apart silently shares another widget's value.
 *
 * @returns the removed widgets, in array order. Empty when the node was
 * already unambiguous, which is the overwhelmingly common case.
 */
export function dropUnrenamableDuplicateWidgets<T extends { name: string }>(
  widgets: T[]
): T[] {
  if (ensureUniqueWidgetNames(widgets)) return []

  const kept: T[] = []
  const refused: T[] = []
  const used = new Set<string>()
  const seen = new Set<T>()
  const reserved = readableNames(widgets)

  for (const widget of widgets) {
    // Nothing new to collide with: either the same widget object occupying a
    // second slot mid-reorder, or a name that cannot be read at all.
    const name = seen.has(widget) ? undefined : readName(widget)
    seen.add(widget)

    if (name === undefined || !used.has(name)) {
      if (name !== undefined) used.add(name)
      kept.push(widget)
      continue
    }

    const unique = freeSuffixedName(name, [used, reserved])
    if (!tryRename(widget, unique)) {
      refused.push(widget)
      continue
    }
    used.add(unique)
    reserved.add(unique)
    kept.push(widget)
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
