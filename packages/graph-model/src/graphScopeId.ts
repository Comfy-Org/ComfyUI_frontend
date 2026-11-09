export type RootGraphId = string & { readonly __brand: 'RootGraphId' }
export type OwningGraphId = string & { readonly __brand: 'OwningGraphId' }

export function toRootGraphId(value: string): RootGraphId {
  return value as RootGraphId
}

export function toOwningGraphId(value: string): OwningGraphId {
  return value as OwningGraphId
}

export interface GraphScope {
  readonly rootGraphId: RootGraphId
  readonly owningGraphId: OwningGraphId
}

export function graphScopeOf(graph: {
  id: string
  rootGraph: { id: string }
}): GraphScope {
  return {
    rootGraphId: toRootGraphId(graph.rootGraph.id),
    owningGraphId: toOwningGraphId(graph.id)
  }
}
