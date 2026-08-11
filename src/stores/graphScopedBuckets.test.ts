import { describe, expect, it } from 'vitest'
import { computed, reactive } from 'vue'

import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'

import { createGraphScopedBuckets } from './graphScopedBuckets'

const rootGraphId = toRootGraphId('root')
const owningGraphId = toOwningGraphId('owner')
const scope = { rootGraphId, owningGraphId }

function buckets() {
  return createGraphScopedBuckets({
    createBucket: () => reactive(new Set<string>()),
    isEmpty: (bucket) => bucket.size === 0
  })
}

describe('createGraphScopedBuckets', () => {
  it('updates a consumer when an owner bucket is created', () => {
    const registry = buckets()
    const size = computed(() => registry.get(scope)?.size ?? 0)

    registry.getOrCreate(scope).add('node')

    expect(size.value).toBe(1)
  })

  it('prunes an empty owner without clearing its siblings', () => {
    const registry = buckets()
    const siblingScope = {
      rootGraphId,
      owningGraphId: toOwningGraphId('sibling')
    }
    const empty = registry.getOrCreate(scope)
    registry.getOrCreate(siblingScope).add('node')

    registry.prune(scope, empty)

    expect(registry.get(scope)).toBeUndefined()
    expect(registry.get(siblingScope)).toEqual(new Set(['node']))
  })

  it('clears one owner or its whole root', () => {
    const registry = buckets()
    const siblingScope = {
      rootGraphId,
      owningGraphId: toOwningGraphId('sibling')
    }
    registry.getOrCreate(scope).add('first')
    registry.getOrCreate(siblingScope).add('second')

    registry.clearOwner(scope)
    expect(registry.get(scope)).toBeUndefined()
    expect(registry.get(siblingScope)).toEqual(new Set(['second']))

    registry.clearRoot(rootGraphId)
    expect(registry.get(siblingScope)).toBeUndefined()
  })
})
