// Phase A stub — replaced by real ECS entityIds when PR #11939 lands.
// Tests mock this module via vi.mock('@/world/entityIds').

export type Brand<T, B extends string> = T & { readonly __brand: B }

export type NodeEntityId = Brand<string, 'NodeEntityId'>
export type WidgetEntityId = Brand<string, 'WidgetEntityId'>
export type EntityId = NodeEntityId | WidgetEntityId
