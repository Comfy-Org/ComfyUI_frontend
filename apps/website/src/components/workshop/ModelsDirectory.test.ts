import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import type { WorkshopModel } from '../../config/models-catalogue'
import { workshopModels } from '../../config/workshop-browse-content'
import ModelsDirectory from './ModelsDirectory.vue'

function model(
  slug: string,
  useCases?: WorkshopModel['useCases']
): WorkshopModel {
  return {
    slug,
    name: slug,
    workflowCount: 0,
    href: `/models/${slug}/`,
    routerId: slug,
    capabilities: [],
    ...(useCases ? { useCases } : {})
  }
}

describe('ModelsDirectory', () => {
  it('server-renders every catalogue model exactly once as a link', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () => h(ModelsDirectory, { models: workshopModels })
      })
    )
    const hrefs = [...html.matchAll(/<a href="([^"]+)"/g)]
      .map((match) => match[1])
      .sort()
    expect(hrefs).toEqual(workshopModels.map((entry) => entry.href).sort())
  })

  it('shelves each model under its primary use case, folds the small formats together, and keeps the unplaced', () => {
    render(ModelsDirectory, {
      props: {
        models: [
          model('paint', ['generate-images']),
          model('song', ['audio']),
          model('poem', ['text']),
          model('retouch', ['edit-images', 'generate-images']),
          model('mystery')
        ]
      }
    })

    const shelves = screen.getAllByRole('region').map((region) => ({
      heading: within(region).getByRole('heading', { level: 2 }).textContent,
      models: within(region)
        .getAllByRole('link')
        .map((link) => link.textContent.trim())
    }))
    expect(shelves).toEqual([
      {
        heading: expect.stringMatching(/Generate images\s+1/),
        models: ['paint']
      },
      {
        heading: expect.stringMatching(/Edit images\s+1/),
        models: ['retouch']
      },
      {
        heading: expect.stringMatching(/Other formats\s+2/),
        models: ['song', 'poem']
      },
      { heading: expect.stringMatching(/Other\s+1/), models: ['mystery'] }
    ])
  })
})
