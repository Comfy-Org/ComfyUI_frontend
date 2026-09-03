import { describe, expect, it } from 'vitest'

import { workshopDetailModels } from './workshop-detail'
import { runTargetFor } from './workshop-run-target'
import { buildRouterSnippet } from './workshop-snippets'

const model = workshopDetailModels[0]

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

  it('resolves every model in the catalog to a target', () => {
    // A snapshot entry naming a target we have no implementation for would
    // otherwise surface as an undefined dereference on that model's page.
    const unresolved = workshopDetailModels.filter(
      (entry) => runTargetFor(entry) === undefined
    )

    expect(unresolved).toEqual([])
  })
})
