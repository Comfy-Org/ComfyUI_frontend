import { shallowReactive } from 'vue'

import type {
  GraphScope,
  OwningGraphId,
  RootGraphId
} from '@/types/graphScopeId'

interface GraphScopedBucketOptions<T> {
  readonly createBucket: () => T
  readonly isEmpty: (bucket: T) => boolean
}

export function createGraphScopedBuckets<T>({
  createBucket,
  isEmpty
}: GraphScopedBucketOptions<T>) {
  const roots = shallowReactive(new Map<RootGraphId, Map<OwningGraphId, T>>())

  function get(scope: GraphScope): T | undefined {
    return roots.get(scope.rootGraphId)?.get(scope.owningGraphId)
  }

  function getOrCreate(scope: GraphScope): T {
    let owners = roots.get(scope.rootGraphId)
    if (!owners) {
      owners = shallowReactive(new Map<OwningGraphId, T>())
      roots.set(scope.rootGraphId, owners)
    }

    const existing = owners.get(scope.owningGraphId)
    if (existing) return existing

    const bucket = createBucket()
    owners.set(scope.owningGraphId, bucket)
    return bucket
  }

  function clearOwner(scope: GraphScope): void {
    const owners = roots.get(scope.rootGraphId)
    if (!owners?.delete(scope.owningGraphId)) return
    if (!owners.size) roots.delete(scope.rootGraphId)
  }

  function prune(scope: GraphScope, bucket: T): void {
    if (!isEmpty(bucket) || get(scope) !== bucket) return
    clearOwner(scope)
  }

  function clearRoot(rootGraphId: RootGraphId): void {
    roots.delete(rootGraphId)
  }

  return { clearOwner, clearRoot, get, getOrCreate, prune }
}
