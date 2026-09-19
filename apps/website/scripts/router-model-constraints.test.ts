import { assert, describe, expect, it } from 'vitest'

import { getRouterWorkshopModelDetail } from '../src/config/workshop-router-content'
import { initialWorkshopPageState } from '../src/config/workshop-page-state'
import { validateForm } from '../src/config/workshop-playground'

describe.for([
  'byteplus--seedance-2-mini-text-to-video--generate-videos',
  'byteplus--seedance-2-fast-text-to-video--generate-videos'
])('Seedance resolution constraints: %s', (slug) => {
  it.for([
    { resolution: '480p', expected: {} },
    { resolution: '720p', expected: {} },
    { resolution: '1080p', expected: { resolution: 'badOption' } },
    { resolution: '4k', expected: { resolution: 'badOption' } }
  ])('validates $resolution before submission', ({ resolution, expected }) => {
    const model = getRouterWorkshopModelDetail(slug)
    assert.exists(model)
    const { schema, values } = initialWorkshopPageState(model)
    expect(validateForm(schema, { ...values, resolution })).toEqual(expected)
  })
})
