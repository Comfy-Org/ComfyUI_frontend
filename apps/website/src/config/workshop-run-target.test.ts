import { describe, expect, it } from 'vitest'

import type { WorkshopModelEntry } from '../content/workshop-models.schema'
import type { WorkshopRunTargetId } from './workshop-detail'
import { toDetailModel } from './workshop-detail'
import { runTargetFor } from './workshop-run-target'
import { buildRouterSnippet } from './workshop-snippets'

const model = toDetailModel({
  id: 'provider/model-v1',
  slug: 'provider--model-v1',
  displayName: 'Model V1',
  provider: 'provider',
  modality: 'image',
  description: 'Generates an image.',
  tags: ['text-to-image'],
  parameters: {
    type: 'object',
    required: ['prompt'],
    properties: {
      prompt: { type: 'string' },
      steps: { type: 'integer', minimum: 1, maximum: 50, default: 25 }
    }
  },
  roles: []
} satisfies WorkshopModelEntry)

describe('workshop run targets', () => {
  it('treats a model with no explicit target as a Router model', () => {
    expect(model.runTarget).toBeUndefined()
    expect(runTargetFor(model).id).toBe('router')
  })

  it('produces the same snippets the Router builder does', () => {
    const target = runTargetFor(model)
    const values = {}

    for (const language of target.snippetLanguages) {
      expect(target.buildSnippet(language, model, values)).toBe(
        buildRouterSnippet(language, model.id, model.fields, values)
      )
    }
  })

  it('offers Router all three languages', () => {
    expect([...runTargetFor(model).snippetLanguages]).toEqual([
      'typescript',
      'python',
      'http'
    ])
  })

  it('resolves every declared target id to an implementation', () => {
    // Listed rather than inferred: adding a member to WorkshopRunTargetId
    // without an implementation fails to compile here, and a member with a
    // missing implementation fails the assertion. Either way it does not
    // reach a page as an undefined dereference.
    const declared: readonly WorkshopRunTargetId[] = ['router']

    for (const id of declared) {
      expect(runTargetFor({ ...model, runTarget: id })).toBeDefined()
    }
  })
})
