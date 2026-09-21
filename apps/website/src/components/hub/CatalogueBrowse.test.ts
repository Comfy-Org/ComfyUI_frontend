import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import type { BrowseEntry } from '../../lib/hub/browse-entry'
import { lastShelf } from '../../lib/workshop/shelf-memory'
import CatalogueBrowse from './CatalogueBrowse.vue'

function entry(overrides: Partial<BrowseEntry> = {}): BrowseEntry {
  const key = overrides.key ?? 'flux'
  const title = overrides.title ?? 'Flux'
  return {
    key,
    kind: 'model',
    title,
    useCases: ['generate-images'],
    models: [],
    tags: [],
    standing: 1,
    date: undefined,
    ...overrides,
    card: {
      kind: overrides.kind ?? 'model',
      href: `/playground/model/${key}/`,
      title,
      media: undefined,
      hoverMedia: undefined,
      maker: { label: 'BFL', logo: undefined },
      needsCustomNodes: false,
      ...overrides.card
    }
  }
}

const workflow = (overrides: Partial<BrowseEntry> = {}) =>
  entry({
    key: 'poster',
    kind: 'workflow',
    title: 'Movie poster',
    models: ['Flux'],
    standing: 400,
    ...overrides
  })

const ENTRIES = [entry(), workflow()]

// A row needs two members to stand, so each job below carries a pair.
const EDITING = [
  workflow({
    key: 'upscale-photo',
    title: 'Upscale a photo',
    useCases: ['edit-images'],
    tags: ['Image Upscale']
  }),
  workflow({
    key: 'restore-scan',
    title: 'Restore a scan',
    useCases: ['edit-images'],
    tags: ['Image Upscale']
  }),
  workflow({
    key: 'erase',
    title: 'Erase an object',
    useCases: ['edit-images'],
    tags: ['Inpainting']
  }),
  workflow({
    key: 'extend',
    title: 'Extend a photo',
    useCases: ['edit-images'],
    tags: ['Outpainting']
  })
]

const shown = () =>
  within(screen.getByTestId('catalogue-grid'))
    .getAllByRole('heading')
    .map((heading) => heading.textContent.trim())

const onShelf = (useCase: string) =>
  within(screen.getByTestId(`shelf-${useCase}`))
    .getAllByTestId('catalogue-card')
    .map((card) => card.getAttribute('data-kind'))

// The URL is read on mount, so the first paint is one tick behind it.
async function at(search: string, entries: readonly BrowseEntry[] = ENTRIES) {
  window.history.replaceState({}, '', `/playground/${search}`)
  render(CatalogueBrowse, { props: { entries } })
  await nextTick()
}

describe('CatalogueBrowse', () => {
  afterEach(() => window.history.replaceState({}, '', '/playground/'))

  // At rest the catalogue is one shelf per thing you might want to make, not a
  // list you have to filter down.
  it('opens on the use cases rather than on a list', async () => {
    await at('')
    expect(screen.getByTestId('playground-sections')).toBeTruthy()
    expect(screen.queryByTestId('catalogue-grid')).toBeNull()
  })

  // A model is a capability and a workflow is a job. They carry different
  // measures and different rows, so each tab is its own catalogue rather than
  // a filter over one shared list.
  it('gives each tab its own shelves', async () => {
    await at('')
    expect(onShelf('generate-images')).toEqual(['workflow'])

    await userEvent.click(screen.getByTestId('catalogue-type-model'))
    expect(onShelf('generate-images')).toEqual(['model'])
  })

  // Three of the eight use cases hold no model at all, and a shelf standing
  // empty says the catalogue is broken rather than that this tab has none.
  it('leaves out a use case the chosen tab has nothing in', async () => {
    await at('', [
      ...ENTRIES,
      workflow({ key: 'mesh', title: 'Photo to mesh', useCases: ['3d'] })
    ])
    expect(screen.getByTestId('shelf-3d')).toBeTruthy()

    await userEvent.click(screen.getByTestId('catalogue-type-model'))
    expect(screen.queryByTestId('shelf-3d')).toBeNull()
  })

  it('opens a shelf into the list for that use case', async () => {
    await at('')
    await userEvent.click(screen.getByTestId('shelf-generate-images-see-all'))
    expect(shown()).toEqual(['Movie poster'])
    expect(screen.getByTestId('catalogue-heading').textContent).toMatch(
      /image/i
    )
  })

  it('opens already narrowed when a model card sent the reader here', async () => {
    await at('?model=Flux')
    expect(shown()).toEqual(['Movie poster'])
    expect(screen.getByTestId('catalogue-chips').textContent).toMatch(/Flux/)
  })

  // The tab says which catalogue you are in, the way the shelf says which use
  // case. Neither is something a reader has to be offered a way out of.
  it('offers nothing to clear when only the tab was chosen', async () => {
    await at('?type=model')
    expect(screen.queryByTestId('catalogue-chips')).toBeNull()
  })

  it('says so rather than showing an empty grid', async () => {
    await at('?q=nothing-matches-this')
    expect(screen.queryByTestId('catalogue-grid')).toBeNull()
    expect(screen.getByTestId('catalogue-empty')).toBeTruthy()
  })

  it('opens a medium on the rows that name a job inside it', async () => {
    await at('', [...ENTRIES, ...EDITING])
    await userEvent.click(screen.getByTestId('shelf-edit-images-open'))

    const rows = screen.getByTestId('outcome-rows')
    expect(within(rows).getByText('Upscale & restore')).toBeTruthy()
    expect(within(rows).getByText('Edit & clean up photos')).toBeTruthy()
  })

  // The job does not declare a medium: one "Upscale & restore" heads the
  // images and the videos, and the tags decide which members it finds there.
  it('heads two shelves with one job', async () => {
    const videos = [
      workflow({
        key: 'upscale-clip',
        title: 'Upscale a clip',
        useCases: ['edit-videos'],
        tags: ['Video Upscale']
      }),
      workflow({
        key: 'smooth-clip',
        title: 'Smooth a clip',
        useCases: ['edit-videos'],
        tags: ['Frame Interpolation']
      })
    ]
    await at('', [...EDITING, ...videos])

    await userEvent.click(screen.getByTestId('shelf-edit-videos-open'))
    expect(
      within(screen.getByTestId('outcome-upscale-restore')).getAllByTestId(
        'catalogue-card'
      )
    ).toHaveLength(2)
  })

  // A job is something a workflow does end to end. No model in the catalogue
  // lists one, so the models tab is a list rather than a set of rows.
  it('heads no row on the models tab', async () => {
    await at('?type=model', [
      ...EDITING,
      entry({ key: 'seedvr', title: 'SeedVR2', useCases: ['edit-images'] }),
      entry({
        key: 'kontext',
        title: 'Flux Kontext',
        useCases: ['edit-images']
      })
    ])

    await userEvent.click(screen.getByTestId('shelf-edit-images-open'))
    expect(screen.queryByTestId('outcome-rows')).toBeNull()
    expect(shown()).toEqual(['Flux Kontext', 'SeedVR2'])
  })

  it('narrows the listing to a row a reader asks to see in full', async () => {
    await at('', [...ENTRIES, ...EDITING])
    await userEvent.click(screen.getByTestId('shelf-edit-images-open'))

    await userEvent.click(screen.getByTestId('outcome-upscale-restore-see-all'))

    expect(shown()).toEqual(['Restore a scan', 'Upscale a photo'])
    expect(screen.queryByTestId('outcome-rows')).toBeNull()
    expect(screen.getByTestId('catalogue-chips').textContent).toContain(
      'Upscale & restore'
    )
  })

  // The way back a reader wants is the shelf they came from, which is what the
  // live catalogue offers, so opening a card leaves that shelf behind it.
  it('leaves the use case behind for the page the card opens', async () => {
    await at('?type=model&useCase=generate-images')

    await userEvent.click(
      within(screen.getByTestId('catalogue-grid')).getAllByTestId(
        'catalogue-card'
      )[0]
    )

    expect(lastShelf('/playground/model/flux/')).toBe('generate-images')
  })

  // Newest over models that carry no date is a ranking over nothing, so the
  // order follows the tab it was chosen for or gives way.
  it('drops a dated order when the reader leaves the workflows behind', async () => {
    await at('?useCase=generate-images')
    await userEvent.click(screen.getByTestId('catalogue-sort'))
    await userEvent.click(await screen.findByTestId('catalogue-sort-newest'))
    expect(shown()).toEqual(['Movie poster'])

    await userEvent.click(screen.getByTestId('catalogue-type-model'))
    expect(shown()).toEqual(['Flux'])
    expect(screen.queryByTestId('catalogue-chips')).toBeNull()
  })
})
