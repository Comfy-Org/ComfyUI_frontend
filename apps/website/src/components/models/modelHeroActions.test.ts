import { describe, expect, it } from 'vitest'

import { modelHeroActions } from './modelHeroActions'

const huggingFaceUrl = 'https://huggingface.co/Comfy-Org/qwen-image'
const docsUrl = 'https://docs.comfy.org/tutorials/qwen-image'

describe('modelHeroActions', () => {
  it.for([
    {
      page: 'a model with workflows',
      model: { hubSlug: 'qwen-image', directory: 'vae', docsUrl },
      shown: [
        ['models.hero.primaryCta', 'solid'],
        ['models.hero.secondaryCta', 'outline'],
        ['models.hero.tutorialCta', 'outline']
      ]
    },
    {
      page: 'a model without workflows',
      model: { directory: 'vae' },
      shown: [
        ['models.hero.secondaryCta', 'solid'],
        ['models.hero.cloudCta', 'outline']
      ]
    },
    {
      page: 'a partner node',
      model: { directory: 'partner_nodes', docsUrl },
      shown: [
        ['models.hero.cloudCta', 'solid'],
        ['models.hero.tutorialCta', 'outline']
      ]
    },
    {
      page: 'a Hub model file',
      model: { hubSlug: 'qwen-image', directory: 'vae', localFile: true },
      shown: [['models.hero.downloadForComfy', 'solid']]
    },
    {
      page: 'a Hub model file without a download',
      model: { directory: 'vae', localFile: true, huggingFaceUrl: '' },
      shown: []
    }
  ])('leads with the first action on $page', ({ model, shown }) => {
    const actions = modelHeroActions({
      huggingFaceUrl,
      localFile: false,
      ...model
    })

    expect(actions.map(({ labelKey, variant }) => [labelKey, variant])).toEqual(
      shown
    )
  })

  it('keeps the visitor on site only for the workflows of the model', () => {
    const actions = modelHeroActions({
      huggingFaceUrl,
      hubSlug: 'qwen-image',
      directory: 'vae',
      docsUrl,
      localFile: false
    })

    expect(actions.map(({ href, external }) => [href, external])).toEqual([
      ['https://comfy.org/workflows/model/qwen-image/', false],
      [huggingFaceUrl, true],
      [docsUrl, true]
    ])
  })
})
