import { describe, expect, it } from 'vitest'

import { workshopModels } from '../../config/workshop-browse-content'
import { modelsHubMeta } from './models-hub-meta'

describe('modelsHubMeta', () => {
  const { title, description } = modelsHubMeta(workshopModels)

  it('titles the hub for ComfyUI models within SERP length', () => {
    expect(title).toContain('ComfyUI Models')
    expect(title.length).toBeLessThanOrEqual(60)
  })

  it('describes the live catalogue in 120 to 160 characters', () => {
    expect(description).toContain(`Browse ${workshopModels.length} AI models`)
    expect(description.length).toBeGreaterThanOrEqual(120)
    expect(description.length).toBeLessThanOrEqual(160)
  })

  it('names five families the catalogue actually has', () => {
    const named = ['FLUX', 'Seedance', 'Kling', 'Veo', 'Nano Banana'].filter(
      (family) => description.includes(family)
    )
    expect(named).toHaveLength(5)
  })

  it('drops a family the catalogue no longer has', () => {
    const { description } = modelsHubMeta([
      { name: 'FLUX 2 Pro Text-to-Image' },
      { name: 'Veo 3 Text-to-Video' }
    ])
    expect(description).toContain('Browse 2 AI models')
    expect(description).toContain('FLUX and Veo')
    expect(description).not.toContain('Kling')
  })

  it('leaves out the names clause when no family is in the catalogue', () => {
    const { description } = modelsHubMeta([{ name: 'Grok Imagine' }])
    expect(description).toBe(
      'Browse 1 AI models in ComfyUI. Try any model in your browser, then call it from your code.'
    )
  })
})
