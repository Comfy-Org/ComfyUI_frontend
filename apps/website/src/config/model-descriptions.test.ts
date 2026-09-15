import { describe, expect, it } from 'vitest'

import {
  buildWhatIsDescription,
  dirLabels,
  isPartnerModel
} from './model-descriptions'
import { models } from './models'

type Model = (typeof models)[number]

function mustFind(predicate: (model: Model) => boolean): Model {
  const model = models.find(predicate)
  if (!model) throw new Error('fixture model missing from registry data')
  return model
}

const partner = mustFind((m) => m.directory === 'partner_nodes')
const open = mustFind((m) => m.directory !== 'partner_nodes')

describe('isPartnerModel', () => {
  it('is true only for partner_nodes models', () => {
    expect(isPartnerModel(partner)).toBe(true)
    expect(isPartnerModel(open)).toBe(false)
  })
})

describe('dirLabels', () => {
  it('labels every registry directory', () => {
    for (const model of models) {
      expect(dirLabels[model.directory]).toBeTruthy()
    }
  })
})

describe('buildWhatIsDescription', () => {
  it('describes partner models as provider-API access, not local weights', () => {
    const text = buildWhatIsDescription(partner)
    expect(text).toContain('partner nodes')
    expect(text).toContain("provider's API")
    expect(text).not.toContain('run it locally')
  })

  it('describes open models as locally runnable', () => {
    const text = buildWhatIsDescription(open)
    expect(text).toContain('run it locally in ComfyUI')
  })

  it('pluralizes the workflow-template count', () => {
    expect(buildWhatIsDescription({ ...open, workflowCount: 1 })).toContain(
      'There is 1 community workflow template'
    )
    expect(buildWhatIsDescription({ ...open, workflowCount: 3 })).toContain(
      'There are 3 community workflow templates'
    )
  })
})
