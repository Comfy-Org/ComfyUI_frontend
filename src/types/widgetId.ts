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
 * failed is fatal. The two must agree: `setNodeId` gates registration on
 * `ensureUniqueWidgetNames`, so a walk that removed a widget this predicate
 * calls renamable would be destroying widgets over a disagreement between two
 * copies of one rule.
 */
function nameIsWritable(widget: { name: string }): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(widget, 'name')
  if (!descriptor) return Object.isExtensible(widget)
  return 'writable' in descriptor ? !!descriptor.writable : !!descriptor.set
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

    for (const { widget, name } of renames) widget.name = name
    return true
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
 * A widget the walk could not name uniquely, with the cause it was recorded
 * under and whether the walk took it off the array.
 */
export interface RefusedWidget<T> {
  widget: T
  cause: WidgetRefusalCause
  /** Whether the walk removed {@link widget} from the array it was given. */
  removed: boolean
}

/**
 * Reads `name` and derives the identity it claims, without letting a hostile
 * accessor escape.
 *
 * Returns the **key**, not the raw value. `widgetId` keys on
 * `encodeURIComponent(String(name))`, so two names that differ as values but
 * coincide as strings — `undefined` against `'undefined'`, `1` against `'1'` —
 * are one identity and have to collide here or they collide downstream where
 * nothing is watching.
 *
 * All three steps are inside the guard on purpose. A getter that throws is the
 * obvious case; a name that does not coerce (`Object.create(null)`) and one
 * that `encodeURIComponent` rejects (a lone surrogate) are the same failure
 * wearing different clothes, and letting either escape wedges this commit and
 * every later one on the node.
 */
function readName(widget: { name: string }): string | typeof UNREADABLE_NAME {
  try {
    // `name` is declared `string` and at runtime is whatever a node pack
    // assigned, which is the entire reason the coercion is here.
    const raw: unknown = widget.name
    const key = String(raw)
    // Mirrors `widgetId`: the key is only usable if the id can be built from it.
    encodeURIComponent(key)
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

/**
 * Whether {@link widget}'s `name` cannot be read at all. Callers that report a
 * refusal need this to name the cause: a widget refused for an unreadable name
 * has no duplicate, so saying it has one is wrong.
 */
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
 * How many distinct names a colliding widget is offered before it is refused.
 *
 * One attempt is not enough: a `name` setter can reject one target and accept
 * another. `BaseWidget`'s delegates to `widgetValueStore.renameWidget`, which
 * refuses to move onto an id the store already holds — so a stale entry under
 * `seed#1` makes a perfectly renamable widget look unrenamable. Refusal
 * deletes the widget, so it has to be the answer to "no name works", not to
 * "the first name I tried did not".
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
 * Decides what becomes of a widget whose name another widget already holds:
 * renamed apart and kept, kept but reported, or refused.
 *
 * Renames `used`/`reserved` in place when an attempt sticks, so the caller's
 * bookkeeping stays a single source of truth for both sets.
 *
 * The middle outcome is the one worth reading. A rename that did not land is
 * not proof of an unaddressable widget: `BaseWidget`'s own `name` setter
 * delegates to `widgetValueStore.renameWidget()` and leaves the name unchanged
 * whenever the store declines — which it does when the node has no entries,
 * exactly the state an ambiguous pair leaves it in and the state a
 * removed-and-re-added node is in before it re-registers. Refusing on the
 * read-back alone therefore destroys ordinary, perfectly renamable widgets on
 * the very nodes this walk repairs, so {@link nameIsWritable} decides removal
 * and the unresolved pair is reported instead of paid for.
 */
function resolveCollision<T extends { name: string }>(
  widget: T,
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
 * It does its own renaming rather than delegating the happy path to
 * {@link ensureUniqueWidgetNames}, which never reads the name back: a setter
 * that accepts the write and ignores it satisfies that check, so delegating
 * would report success over a node that still carries an ambiguous pair. The
 * read-back is therefore what decides whether the pair is *reported* —
 * but **not** whether the widget is removed. {@link nameIsWritable} decides
 * that, because a failed write is a recoverable store refusal as often as it
 * is a hostile object, and the two are indistinguishable from the read alone.
 *
 * @returns every widget it could not name uniquely, with the cause and whether
 * it was removed, in array order. Empty when the node is unambiguous, which is
 * the overwhelmingly common case. The cause is recorded here rather than
 * re-derived by the caller: re-reading a hostile accessor to ask "was this one
 * unreadable?" can answer differently the second time and mislabel the report.
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
      // No readable name means no derivable `WidgetId`, and leaving it on the
      // node makes `ensureUniqueWidgetNames` fail on every later call — which
      // bails registration for every *other* widget on the node too.
      verdicts.set(widget, false)
      refused.push({ widget, cause: 'unreadable-name', removed: true })
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
      refused.push({ widget, cause: outcome.cause, removed: !outcome.keep })
    }
  }

  // `kept` holds every widget that was not removed, in order, so this is a
  // no-op rebuild when the only findings were kept ones.
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
