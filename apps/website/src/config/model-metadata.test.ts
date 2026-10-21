import {
  createTemplateSearchIndex,
  searchTemplates
} from '@comfyorg/shared-frontend-utils/templateSearch'
import { describe, expect, it } from 'vitest'

import hubTemplates from '@/data/hubTemplates.json'
import { modelMetadata } from './model-metadata'

const index = createTemplateSearchIndex(hubTemplates)
const searches = Object.entries(modelMetadata).flatMap(
  ([slug, { hubSearch }]) => (hubSearch ? [[slug, hubSearch] as const] : [])
)

describe('model hubSearch terms', () => {
  it.for(searches)(
    'the %s search for "%s" finds a family, not the whole catalog',
    ([, term]) => {
      const found = searchTemplates(index, term).length
      expect(found).toBeGreaterThan(0)
      expect(found).toBeLessThanOrEqual(hubTemplates.length / 4)
    }
  )
})
