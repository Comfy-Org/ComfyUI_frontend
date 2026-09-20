import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'

import { useHubStore } from '../../composables/useHubStore'
import { groupModels } from '../../config/model-family'
import { sortWorkshopModels, useCasesFor } from '../../config/models-catalogue'
import { workshopModels } from '../../config/workshop-browse-content'
import hubTemplates from '../../data/hubTemplates.json'
import type { HubTemplate } from '../../lib/hub/types'
import HubBrowse from './HubBrowse.vue'

const templates = hubTemplates as HubTemplate[]

function templateNamed(name: string): HubTemplate {
  const template = templates.find((candidate) => candidate.name === name)
  if (!template) throw new Error(`Expected the ${name} workflow fixture`)
  return template
}

afterEach(() => {
  useHubStore().reset()
})

describe('HubBrowse', () => {
  it('scopes the grid to Comfy Apps and narrows it by search', async () => {
    const user = userEvent.setup()
    render(HubBrowse)
    expect(screen.getAllByTestId('hub-card')).toHaveLength(30)

    await user.click(screen.getByTestId('hub-tab-comfyApps'))
    const apps = screen.getAllByTestId('hub-card')
    expect(apps.length).toBeGreaterThan(0)
    expect(apps.every((card) => card.getAttribute('data-app') === 'true')).toBe(
      true
    )

    await user.click(screen.getByTestId('hub-tab-all'))
    await user.type(screen.getByTestId('workshop-search'), 'minimax h3')
    expect(screen.getAllByTestId('hub-card-link')[0].textContent).toContain(
      'MiniMax H3'
    )
  })

  it('shows the Workshop model cards under the Models tab', async () => {
    const user = userEvent.setup()
    render(HubBrowse)
    await user.click(screen.getByTestId('hub-tab-models'))
    expect(screen.queryByTestId('hub-grid')).toBeNull()
    expect(screen.getAllByTestId('workshop-model-card').length).toBeGreaterThan(
      10
    )
    await user.type(screen.getByTestId('workshop-search'), 'upscale')
    const cards = screen.getAllByTestId('workshop-model-card')
    expect(cards.length).toBeGreaterThan(0)
    cards.forEach((card) => expect(card.textContent).toMatch(/Upscale/i))
  })

  it('does not show a duplicate search results panel', async () => {
    const user = userEvent.setup()
    render(HubBrowse)
    expect(screen.queryByTestId('workshop-search-panel')).toBeNull()

    await user.click(screen.getByTestId('hub-tab-models'))
    await user.type(screen.getByTestId('workshop-search'), 'kling')
    expect(screen.queryByTestId('workshop-search-panel')).toBeNull()
  })

  it('filters by a model facet from the Filter popover', async () => {
    const user = userEvent.setup()
    render(HubBrowse)
    await user.click(screen.getByTestId('hub-filter'))
    await user.click(screen.getByTestId('hub-facet-models'))
    await user.click(await screen.findByRole('option', { name: 'Wan' }))
    expect(screen.getByTestId('hub-filter-count').textContent.trim()).toBe('1')
    expect(screen.getByTestId('hub-showing').textContent).toContain('of 36')
  })

  it('scopes both the models and the workflows to the chosen use case', async () => {
    const user = userEvent.setup()
    const audioWorkflow = templateNamed('audio_minimax_music_3')
    const videoWorkflow = templateNamed('api_seedance2_5_t2v')
    const source = workshopModels.find((model) =>
      model.useCases?.includes('audio')
    )
    if (!source) throw new Error('Expected an audio model fixture')
    const secondaryAudio = {
      ...source,
      useCases: ['generate-videos', 'audio'] as const
    }
    const models = workshopModels.map((model) =>
      model.slug === secondaryAudio.slug ? secondaryAudio : model
    )
    render(HubBrowse, {
      props: { models, templates: [audioWorkflow, videoWorkflow] }
    })

    await user.click(screen.getByTestId('hub-use-case-audio'))
    const lead = screen.getAllByTestId('hub-models-lead')
    const audioModelHrefs = groupModels(
      sortWorkshopModels(
        models.filter((model) => useCasesFor(model).includes('audio')),
        'popular'
      )
    ).map((family) => family.latest.href)
    expect(audioModelHrefs.length).toBeGreaterThan(0)
    expect(audioModelHrefs).toContain(lead[0].getAttribute('href'))
    expect(screen.getByTestId('hub-showing').textContent).toMatch(
      /of [1-9]\d*\b/
    )
    expect(
      screen.getAllByTestId('hub-card-link').map((card) => card.textContent)
    ).toEqual(['MiniMax Music 3: Text to Music'])
    expect(
      screen.queryByRole('link', { name: /Seedance 2.5: Text to Video/ })
    ).toBeNull()

    await user.click(screen.getByTestId('hub-tab-models'))
    const modelCards = screen.getAllByTestId('workshop-model-card')
    const renderedModelHrefs = modelCards.map((card) =>
      card.getAttribute('href')
    )
    expect(new Set(renderedModelHrefs)).toEqual(new Set(audioModelHrefs))
    expect(renderedModelHrefs).toEqual(audioModelHrefs)
    expect(
      modelCards.some((card) => card.textContent.includes(secondaryAudio.name))
    ).toBe(true)
    expect(screen.queryByTestId('model-card-versions')).toBeNull()
  })

  it('updates workflow partner facets when the model collection changes', async () => {
    const user = userEvent.setup()
    const workflow = templateNamed('api_beeble_switchx_image_edit')
    const model = workshopModels.find(
      (candidate) =>
        candidate.slug === 'beeble--switchx-image-edit--edit-images'
    )
    if (!model) throw new Error('Expected the SwitchLight workflow model')
    const modelsWithProvider = (provider: string) => [{ ...model, provider }]
    const { rerender } = render(HubBrowse, {
      props: {
        models: modelsWithProvider('Initial partner'),
        templates: [workflow]
      }
    })

    await user.click(screen.getByTestId('hub-filter'))
    await user.click(screen.getByTestId('hub-facet-partners'))
    expect(
      await screen.findByRole('option', { name: 'Initial partner' })
    ).toBeTruthy()

    await rerender({
      models: modelsWithProvider('Updated partner'),
      templates: [workflow]
    })
    expect(
      await screen.findByRole('option', { name: 'Updated partner' })
    ).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Initial partner' })).toBeNull()
  })

  it('counts the applied filters in the popover and clears them', async () => {
    const user = userEvent.setup()
    render(HubBrowse)
    await user.click(screen.getByTestId('hub-filter'))
    await user.click(screen.getByTestId('hub-facet-models'))
    await user.click(await screen.findByRole('option', { name: 'Wan' }))
    expect(screen.getByTestId('hub-facet-models').textContent).toContain(
      '1 selected'
    )

    await user.click(screen.getByTestId('hub-filter-clear'))
    expect(screen.queryByTestId('hub-filter-count')).toBeNull()
  })

  it('offers the orders each tab can honour, and orders by the one chosen', async () => {
    const user = userEvent.setup()
    render(HubBrowse)

    await user.click(screen.getByTestId('hub-tab-nodeGraphs'))
    await user.click(screen.getByTestId('hub-sort'))
    expect(screen.queryByTestId('hub-sort-priceAsc')).toBeNull()
    await user.click(await screen.findByTestId('hub-sort-name'))
    const titles = screen
      .getAllByTestId('hub-card-link')
      .map((card) => card.textContent.trim())
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)))

    await user.click(screen.getByTestId('hub-tab-models'))
    await user.click(screen.getByTestId('hub-sort'))
    expect(await screen.findByTestId('hub-sort-priceAsc')).toBeTruthy()
    expect(screen.queryByTestId('hub-sort-newest')).toBeNull()
  })

  it('filters from the phone panel, one facet at a time', async () => {
    const user = userEvent.setup()
    render(HubBrowse)
    await user.click(screen.getByTestId('hub-filter'))

    await user.click(screen.getByTestId('workshop-facet-media'))
    await user.click(await screen.findByTestId('filter-media-video'))

    expect(screen.getByTestId('hub-filter-count').textContent.trim()).toBe('1')
  })
})
