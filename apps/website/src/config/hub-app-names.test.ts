import { describe, expect, it } from 'vitest'

import hubAppNames from './hub-app-names.json' with { type: 'json' }
import { hubAppName } from './hub-models'
import { appModels } from './workshop-app-content'

describe('hub-app-names.json', () => {
  it('lists every published app page', () => {
    const names = appModels.map(({ slug }) => hubAppName(slug)).sort()
    expect(names).not.toHaveLength(0)
    expect(hubAppNames).toEqual(names)
  })
})
