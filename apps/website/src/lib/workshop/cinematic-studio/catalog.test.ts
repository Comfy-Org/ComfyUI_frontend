import { describe, expect, it } from 'vitest'

import { workshopContract } from '../../../config/workshop-contract-catalog'
import { runnableCinematicModels } from './catalog'

const execution = workshopContract('bfl/flux-2-pro')

describe('runnableCinematicModels', () => {
  it('keeps studio models that can run and gives each its logo', () => {
    const models = runnableCinematicModels((slug) =>
      slug === 'bfl--flux-2-pro--generate-images'
        ? { slug, name: 'FLUX.2 Pro', provider: 'Black Forest Labs', execution }
        : undefined
    )

    expect(models).toEqual([
      {
        slug: 'bfl--flux-2-pro--generate-images',
        name: 'FLUX.2 Pro',
        provider: 'Black Forest Labs',
        logo: '/icons/ai-models/bfl.svg'
      }
    ])
  })

  it('drops a model the Router cannot run yet', () => {
    const models = runnableCinematicModels((slug) => ({
      slug,
      name: slug,
      execution: slug.startsWith('krea') ? execution : undefined
    }))

    expect(models.map((model) => model.slug)).toEqual([
      'krea--krea-2-large--generate-images'
    ])
  })

  it('refuses to build a studio with nothing to run', () => {
    expect(() => runnableCinematicModels(() => undefined)).toThrow(
      'Cinematic Studio has no runnable models'
    )
  })
})
