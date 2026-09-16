import { describe, expect, it } from 'vitest'

import { browseRequestFrom } from './browse-entry'

describe('browseRequestFrom', () => {
  it('opens on everything when the link asks for nothing', () => {
    expect(browseRequestFrom('')).toEqual({
      type: 'all',
      useCase: 'all',
      usesModel: '',
      query: ''
    })
  })

  it('reads the type, the use case and the search off the link', () => {
    expect(browseRequestFrom('?type=app&useCase=edit-images&q=poster')).toEqual(
      {
        type: 'app',
        useCase: 'edit-images',
        usesModel: '',
        query: 'poster'
      }
    )
  })

  it('ignores a type and a use case it does not have', () => {
    const asked = browseRequestFrom('?type=sculpture&useCase=knitting')
    expect(asked.type).toBe('all')
    expect(asked.useCase).toBe('all')
  })

  // "42 workflows use this" is a link, and what it means is the workflows, not
  // the model beside them.
  it('reads a model link as a request for the workflows that use it', () => {
    const asked = browseRequestFrom('?model=Nano%20Banana%20Pro')
    expect(asked.usesModel).toBe('Nano Banana Pro')
    expect(asked.type).toBe('workflow')
  })

  it('lets the model link win over a type the same link names', () => {
    expect(browseRequestFrom('?model=Flux&type=model').type).toBe('workflow')
  })
})
