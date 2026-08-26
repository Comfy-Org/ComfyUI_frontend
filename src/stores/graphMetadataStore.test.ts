import { describe, expect, it } from 'vitest'

import type { UUID } from '@/utils/uuid'

import { useGraphMetadataStore } from './graphMetadataStore'

describe(useGraphMetadataStore, () => {
  const first = '00000000-0000-4000-8000-000000000001' as UUID
  const second = '00000000-0000-4000-8000-000000000002' as UUID

  it('rekeys one canonical metadata record', () => {
    const store = useGraphMetadataStore()
    const metadata = store.get(first)
    metadata.revision = 3
    metadata.config = { links_ontop: true }
    metadata.extra = { workflowRendererVersion: 'Vue' }

    store.rekeyRoot(first, second)

    expect(store.get(second)).toBe(metadata)
    expect(store.get(second)).toMatchObject({
      revision: 3,
      config: { links_ontop: true },
      extra: { workflowRendererVersion: 'Vue' }
    })
    expect(store.get(first)).not.toBe(metadata)
  })

  it('clears only the selected graph', () => {
    const store = useGraphMetadataStore()
    const firstMetadata = store.get(first)
    const secondMetadata = store.get(second)

    store.clear(first)

    expect(store.get(first)).not.toBe(firstMetadata)
    expect(store.get(second)).toBe(secondMetadata)
  })

  it('scopes subgraph metadata by root graph', () => {
    const store = useGraphMetadataStore()
    const subgraphId = '00000000-0000-4000-8000-000000000003' as UUID

    expect(store.get(first, subgraphId)).not.toBe(store.get(second, subgraphId))
  })
})
