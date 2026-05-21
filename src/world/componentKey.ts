// Phase A stub — replaced by real ECS componentKey when PR #11939 lands.
// Tests mock this module via vi.mock('@/world/componentKey').

export interface ComponentKey<_TData, _TEntity> {
  readonly name: string
}

export function defineComponentKey<TData, TEntity>(
  name: string
): ComponentKey<TData, TEntity> {
  return { name }
}
