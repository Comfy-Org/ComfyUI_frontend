import { describe, expect, it } from 'vitest'

import hubTemplates from '@/data/hubTemplates.json'
import { vfxWorkflows } from './vfxWorkflows'

const hubTags = new Set(hubTemplates.flatMap((template) => template.tags))

describe('VFX workflow cards', () => {
  it.for(vfxWorkflows.map(({ template }) => template))(
    '$title links only tags that Hub templates carry',
    ({ tags }) => {
      expect(tags.filter((tag) => !hubTags.has(tag))).toEqual([])
    }
  )
})
