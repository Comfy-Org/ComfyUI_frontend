import { describe, expect, it } from 'vitest'

import { OUT_OF_MEMORY_CATALOG_ID } from '@/platform/errorCatalog/catalogIds'
import { resolveRuntimeCatalogMatch } from '@/platform/errorCatalog/runtimeErrorMatcher'

import { prototypeOutOfMemoryError } from './prototypeOutOfMemory'

describe('prototypeOutOfMemoryError', () => {
  it('fails the first sampler with an error the catalog reads as out of memory', () => {
    const error = prototypeOutOfMemoryError(
      [
        { id: 4, type: 'CheckpointLoaderSimple' },
        { id: 3, type: 'KSampler' },
        { id: 9, type: 'SaveImage' }
      ],
      1000
    )

    expect(error).toMatchObject({ node_id: '3', node_type: 'KSampler' })
    expect(
      resolveRuntimeCatalogMatch({
        exceptionType: error?.exception_type ?? '',
        exceptionMessage: error?.exception_message ?? ''
      })?.catalogId
    ).toBe(OUT_OF_MEMORY_CATALOG_ID)
  })

  it('fails the last node when the graph has no sampler', () => {
    expect(
      prototypeOutOfMemoryError(
        [
          { id: 1, type: 'LoadImage' },
          { id: 2, type: 'SaveImage' }
        ],
        1000
      )?.node_id
    ).toBe('2')
  })

  it('has nothing to fail in an empty graph', () => {
    expect(prototypeOutOfMemoryError([], 1000)).toBeNull()
  })
})
