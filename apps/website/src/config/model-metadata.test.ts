import {
  createTemplateSearchIndex,
  searchTemplates
} from '@comfyorg/shared-frontend-utils/templateSearch'
import { describe, expect, it } from 'vitest'

import hubTemplates from '@/data/hubTemplates.json'
import { models } from './models'

const FUZZY_PREFIX_TERMS = new Set(['meshy', 'vidu', 'luma'])

const index = createTemplateSearchIndex(hubTemplates)
const bySlug = new Map(
  hubTemplates.map((template) => [template.name, template])
)
const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

function contains(slug: string, term: string): boolean {
  const template = bySlug.get(slug)
  if (!template) return false
  return [template.name, template.title, ...template.models, ...template.tags]
    .map(normalize)
    .some((field) => field.includes(normalize(term)))
}

const searches = models.flatMap(({ slug, displayName, hubSearch }) =>
  hubSearch ? [{ slug, displayName, term: hubSearch }] : []
)

describe(`model hubSearch terms over the ${hubTemplates.length} raw hubTemplates.json templates`, () => {
  it.for(searches)(
    '$slug: "$term" names the model, and every hit (most hits for a fuzzy-prefix term) contains it',
    ({ slug, displayName, term }) => {
      expect([slug, displayName].map(normalize).join(' ')).toContain(
        normalize(term)
      )

      const hits = searchTemplates(index, term)
      const containing = hits.filter((hit) => contains(hit, term))
      expect(hits.length).toBeGreaterThan(0)
      if (FUZZY_PREFIX_TERMS.has(term)) {
        expect(containing.length).toBeGreaterThan(hits.length / 2)
      } else {
        expect(containing).toEqual(hits)
      }
    }
  )
})
