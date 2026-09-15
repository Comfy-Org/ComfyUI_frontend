/**
 * Branded entity ID types for compile-time cross-kind safety.
 *
 * Each entity kind gets a nominal type wrapping its underlying primitive.
 * The brand prevents accidentally passing a LinkEntityId where a
 * NodeEntityId is expected — a class of bugs that plain `number` allows.
 *
 * At runtime these are just numbers (or strings for subgraphs). The brand
 * is erased by TypeScript and has zero runtime cost.
 *
 * @see {@link ../../../docs/adr/0008-entity-component-system.md}
 */

// -- Branded ID types -------------------------------------------------------

type Brand<T, B extends string> = T & { readonly __brand: B }

export type NodeEntityId = Brand<number, 'NodeEntityId'>
export type LinkEntityId = Brand<number, 'LinkEntityId'>
export type SubgraphEntityId = Brand<string, 'SubgraphEntityId'>
export type WidgetEntityId = Brand<number, 'WidgetEntityId'>
export type SlotEntityId = Brand<number, 'SlotEntityId'>
export type RerouteEntityId = Brand<number, 'RerouteEntityId'>
export type GroupEntityId = Brand<number, 'GroupEntityId'>

/** Union of all entity ID types. */
export type EntityId =
  | NodeEntityId
  | LinkEntityId
  | SubgraphEntityId
  | WidgetEntityId
  | SlotEntityId
  | RerouteEntityId
  | GroupEntityId

// -- Cast helpers (for use at system boundaries) ----------------------------

export function asNodeEntityId(id: number): NodeEntityId {
  return id as NodeEntityId
}

export function asLinkEntityId(id: number): LinkEntityId {
  return id as LinkEntityId
}

export function asSubgraphEntityId(id: string): SubgraphEntityId {
  return id as SubgraphEntityId
}

export function asWidgetEntityId(id: number): WidgetEntityId {
  return id as WidgetEntityId
}

export function asSlotEntityId(id: number): SlotEntityId {
  return id as SlotEntityId
}

export function asRerouteEntityId(id: number): RerouteEntityId {
  return id as RerouteEntityId
}

export function asGroupEntityId(id: number): GroupEntityId {
  return id as GroupEntityId
}
