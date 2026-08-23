import { describe, expect, it } from 'vitest'

import type { Model } from '../../../config/models'
import { summarizeModelExploreCatalog } from './modelExploreCatalog'

describe('summarizeModelExploreCatalog', () => {
  it('separates local model components from partner integrations', () => {
    const catalog = [
      { directory: 'checkpoints' },
      { directory: 'loras' },
      { directory: 'partner_nodes' }
    ] satisfies Array<Pick<Model, 'directory'>>

    expect(summarizeModelExploreCatalog(catalog)).toEqual({
      catalogCount: 3,
      localComponentCount: 2,
      partnerIntegrationCount: 1
    })
  })
})
