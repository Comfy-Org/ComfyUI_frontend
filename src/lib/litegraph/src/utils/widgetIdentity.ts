import type { ISerialisedWidgetValueEntry } from '../types/serialisation'
import type { IBaseWidget, TWidgetValue } from '../types/widgets'
import { isWidgetValue } from '../types/widgets'

/**
 * A node may legally carry two serializable widgets with the same name, which
 * `widgets_values_named` cannot represent — the later one overwrites the
 * earlier. `widgets_values_ordered` addresses each one by `(name, occurrence)`
 * instead; this module is the shared reader and writer for that field.
 *
 * It lives apart from `LGraphNode` because the widget value store reads the
 * same identity, and `LGraphNode` already imports that store.
 *
 * The runtime `WidgetId` (`graphId:nodeId:name`) is unchanged and still
 * collides on a repeated name; see the serialized-identity amendment in
 * `docs/adr/ECS-0008-entity-component-system.md`.
 */

/**
 * Separator between the occurrence and the name in a lookup key.
 *
 * Spelled as a unicode escape and never as a raw byte: a raw NUL makes git
 * classify the whole file as binary and hide every line of it from the diff.
 */
const WIDGET_IDENTITY_SEPARATOR = '\u0000'

/**
 * Lookup key for one `(name, occurrence)` widget identity.
 *
 * A widget name may contain any character, the separator included, so the key
 * is injective only because the occurrence is a digit run that the *first*
 * separator terminates. Everything after that separator is the name verbatim.
 * Keep the occurrence leading, and keep {@link readOrderedWidgetValues}'
 * integer guard — a non-integer or string occurrence breaks the digit-run
 * assumption and can collide with a well-formed identity.
 */
export function widgetIdentityKey(name: string, occurrence: number): string {
  return `${String(occurrence)}${WIDGET_IDENTITY_SEPARATOR}${name}`
}

/**
 * Keys an incoming entry carried besides `name`, `occurrence` and `value`.
 *
 * A newer or third-party producer may add its own; this reader does not
 * interpret them, and {@link buildOrderedWidgetValues} writes them back so a
 * load/save cycle in this app does not delete them.
 */
export type UnknownEntryKeys = Readonly<Record<string, unknown>>

const KNOWN_ENTRY_KEYS: ReadonlySet<string> = new Set([
  'name',
  'occurrence',
  'value'
])

export interface OrderedWidgetValues {
  /** Value per {@link widgetIdentityKey}. */
  byIdentity: ReadonlyMap<string, TWidgetValue>
  /** Highest occurrence the *document* carries for each name. */
  lastOccurrence: ReadonlyMap<string, number>
  /**
   * Per-identity keys this reader does not understand. Empty for every entry
   * that carried only the three known keys, which is the ordinary case.
   */
  unknownKeys: ReadonlyMap<string, UnknownEntryKeys>
}

/** Keys of `entry` that are not part of the known triple, or `undefined`. */
function collectUnknownKeys(entry: object): UnknownEntryKeys | undefined {
  let extras: Record<string, unknown> | undefined
  for (const [key, value] of Object.entries(entry)) {
    if (KNOWN_ENTRY_KEYS.has(key)) continue
    extras ??= {}
    extras[key] = value
  }
  return extras
}

interface ParsedEntry {
  identity: string
  name: string
  occurrence: number
  value: TWidgetValue
  unknown: UnknownEntryKeys | undefined
}

/**
 * The `(name, occurrence)` an entry addresses, or `undefined`.
 *
 * A non-integer or negative occurrence is rejected rather than coerced: the
 * lookup key encodes the occurrence as a leading digit run, so `'0'` or `2.5`
 * either collides with a well-formed identity or produces one nothing can
 * address. See {@link widgetIdentityKey}.
 */
function readEntryIdentity(
  entry: object
): { name: string; occurrence: number } | undefined {
  if (!('name' in entry) || !('occurrence' in entry)) return undefined

  const { name, occurrence } = entry
  if (typeof name !== 'string') return undefined
  if (typeof occurrence !== 'number') return undefined
  if (!Number.isInteger(occurrence) || occurrence < 0) return undefined

  return { name, occurrence }
}

/** Validates one untrusted entry, or rejects it. */
function parseEntry(entry: unknown): ParsedEntry | undefined {
  if (typeof entry !== 'object' || entry === null) return undefined

  const identity = readEntryIdentity(entry)
  if (!identity) return undefined

  const value: unknown = 'value' in entry ? entry.value : undefined
  if (!isWidgetValue(value)) return undefined

  return {
    ...identity,
    identity: widgetIdentityKey(identity.name, identity.occurrence),
    value,
    unknown: collectUnknownKeys(entry)
  }
}

/**
 * Indexes `widgets_values_ordered`, skipping any entry whose identity is not
 * well-formed rather than rejecting the whole field. The producer may be a
 * newer writer carrying keys this one does not know, and the fallback for an
 * unusable entry is exactly the behaviour the node had before the field
 * existed.
 *
 * The parameter is `unknown` because the field arrives from a document no
 * schema validates — the workflow schema passes it through — so this function,
 * not the declared type, is where its shape is established. It must not throw:
 * it runs outside `LGraphNode.configure`'s `try`/`finally`, so a `TypeError`
 * here would abort the whole graph load.
 *
 * @returns `undefined` when nothing usable was found, so callers can treat
 * absent and unusable identically.
 */
export function readOrderedWidgetValues(
  entries: unknown
): OrderedWidgetValues | undefined {
  if (!Array.isArray(entries)) return undefined
  const unvalidated: readonly unknown[] = entries

  const byIdentity = new Map<string, TWidgetValue>()
  const lastOccurrence = new Map<string, number>()
  const unknownKeys = new Map<string, UnknownEntryKeys>()
  for (const entry of unvalidated) {
    const parsed = parseEntry(entry)
    if (!parsed) continue

    byIdentity.set(parsed.identity, parsed.value)
    if (parsed.unknown) unknownKeys.set(parsed.identity, parsed.unknown)
    const highest = lastOccurrence.get(parsed.name)
    if (highest === undefined || parsed.occurrence > highest) {
      lastOccurrence.set(parsed.name, parsed.occurrence)
    }
  }
  return byIdentity.size > 0
    ? { byIdentity, lastOccurrence, unknownKeys }
    : undefined
}

/** One serializable widget's place among its node's serializable widgets. */
export interface SerializableWidgetIdentity {
  widget: IBaseWidget
  /** Index among the node's serializable widgets. */
  positionalIndex: number
  /** Zero-based index among the serializable widgets sharing the name. */
  occurrence: number
  /** How many serializable widgets share the name. */
  occurrenceCount: number
}

function countSerializableNames(
  widgets: readonly IBaseWidget[]
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (const widget of widgets) {
    if (widget.serialize === false) continue
    counts.set(widget.name, (counts.get(widget.name) ?? 0) + 1)
  }
  return counts
}

/**
 * The single walk that decides which widgets serialize and what each one's
 * occurrence is.
 *
 * Restore and serialize have to agree on this exactly — a widget written as
 * occurrence 1 and read back as occurrence 0 silently swaps two values — so
 * the filter and the counting live here once rather than at each call site.
 * `addCustomWidget` is the deliberate exception: it sees one widget at a time
 * and cannot know the totals.
 *
 * Lazy, and indexed rather than snapshotted, because a consumer may append
 * while it runs: `LGraphNode.configure` assigns widget values, and an
 * extension's value setter can add a widget as a result —
 * `src/extensions/core/customWidgets.ts` grows an `optionN` widget each time
 * the last one is filled in. Those widgets have to be visited too, so the
 * walk reads the live array.
 *
 * `occurrenceCount` is counted once up front, from the list as it stands.
 * Resolving the final occurrence needs the total for a name, and a widget
 * appended mid-walk has a name nothing has claimed yet.
 */
export function* serializableWidgetIdentities(
  widgets: readonly IBaseWidget[]
): Generator<SerializableWidgetIdentity> {
  const counts = countSerializableNames(widgets)
  const seen = new Map<string, number>()
  let positionalIndex = 0

  for (let index = 0; index < widgets.length; index++) {
    const widget = widgets[index]
    if (widget.serialize === false) continue
    const occurrence = seen.get(widget.name) ?? 0
    seen.set(widget.name, occurrence + 1)
    yield {
      widget,
      positionalIndex: positionalIndex++,
      occurrence,
      occurrenceCount: counts.get(widget.name) ?? 1
    }
  }
}

/**
 * Deep copy of one widget's serialized value.
 *
 * Every serialized register gets its own copy: `widgets_values`,
 * `widgets_values_named` and `widgets_values_ordered` otherwise share one
 * object per widget, so rewriting an ordered entry's `value` in place — the
 * pattern {@link ISerialisedWidgetValueEntry} sanctions — would silently
 * rewrite the other two, including the slot a *different* widget of a repeated
 * name occupies. No JSON round trip breaks that aliasing on the in-memory
 * `configure(serialize())` paths: copy/paste, undo, subgraph conversion.
 */
export function cloneWidgetValue(value: TWidgetValue): TWidgetValue {
  return typeof value === 'object' && value !== null
    ? (JSON.parse(JSON.stringify(value)) as TWidgetValue)
    : (value ?? null)
}

/**
 * Builds the lossless ordered form for one node's serializable widgets.
 *
 * @param identities Every serializable widget's identity, from
 * {@link serializableWidgetIdentities}.
 * @param unknownKeys Keys the incoming document carried per identity, from
 * {@link OrderedWidgetValues.unknownKeys}. Merged under the known triple so a
 * producer-specific key survives a load/save cycle here; an identity the live
 * node no longer has simply drops out.
 * @returns `undefined` when no name repeats — the ordered form would then say
 * nothing `widgets_values_named` does not already say, and emitting it anyway
 * would add a redundant third copy of every workflow's widget values.
 */
export function buildOrderedWidgetValues(
  identities: readonly SerializableWidgetIdentity[],
  unknownKeys?: ReadonlyMap<string, UnknownEntryKeys>
): ISerialisedWidgetValueEntry[] | undefined {
  if (!identities.some(({ occurrenceCount }) => occurrenceCount > 1)) {
    return undefined
  }

  return identities.map(({ widget, occurrence }) => ({
    // The known triple always wins: a stale `value` or `occurrence` carried as
    // an unknown key must never shadow what this node actually holds.
    ...unknownKeys?.get(widgetIdentityKey(widget.name, occurrence)),
    name: widget.name,
    occurrence,
    value: cloneWidgetValue(widget.value)
  }))
}

/**
 * Unknown entry keys the last configured document carried, per node.
 *
 * Off the node on purpose: this is persistence bookkeeping, not entity state,
 * and a public field named with an underscore is still reachable by any
 * extension — whatever one assigned would come straight back out of
 * `serialize()`. `extensionPersistence.ts` holds its own per-node state the
 * same way.
 */
const unknownOrderedKeysByNode = new WeakMap<
  object,
  ReadonlyMap<string, UnknownEntryKeys>
>()

/**
 * Records the unknown entry keys `node`'s document carried, so the next
 * `serialize()` writes them back. Clearing on a document without the field is
 * the point of the `undefined` case — stale keys must not outlive it.
 */
export function setUnknownOrderedWidgetKeys(
  node: object,
  keys: ReadonlyMap<string, UnknownEntryKeys> | undefined
): void {
  if (keys) unknownOrderedKeysByNode.set(node, keys)
  else unknownOrderedKeysByNode.delete(node)
}

export function getUnknownOrderedWidgetKeys(
  node: object
): ReadonlyMap<string, UnknownEntryKeys> | undefined {
  return unknownOrderedKeysByNode.get(node)
}
