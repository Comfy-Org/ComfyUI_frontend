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
      href: `/hub/model/${key}/`,
      title,
      media: undefined,
      hoverMedia: undefined,
      maker: { label: 'BFL', logo: undefined },
      mark: { label: 'BFL', logo: undefined },
      badges: [],
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
async function at(
  search: string,
  entries: readonly BrowseEntry[] = ENTRIES,
  modelFilter = false
) {
  window.history.replaceState({}, '', `/hub/${search}`)
  render(CatalogueBrowse, { props: { entries, modelFilter } })
  await nextTick()
}

describe('CatalogueBrowse', () => {
  afterEach(() => window.history.replaceState({}, '', '/hub/'))

  // At rest the catalogue is one shelf per thing you might want to make, not a
  // list you have to filter down.
  it('opens on the use cases rather than on a list', async () => {
    await at('')
    expect(screen.getByTestId('hub-sections')).toBeTruthy()
    expect(screen.queryByTestId('catalogue-grid')).toBeNull()
  })

  // A model is a capability and a workflow is a job. They carry different
  // measures and different rows, so each tab is its own catalogue rather than
  // a filter over one shared list.
  it('gives each tab its own shelves', async () => {
    await at('')
    expect(onShelf('generate-images')).toEqual(['model'])

    await userEvent.click(screen.getByTestId('catalogue-type-workflow'))
    expect(onShelf('generate-images')).toEqual(['workflow'])
  })

  // Three of the eight use cases hold no model at all, and a shelf standing
  // empty says the catalogue is broken rather than that this tab has none.
  it('leaves out a use case the chosen tab has nothing in', async () => {
    await at('?type=workflow', [
      ...ENTRIES,
      workflow({ key: 'mesh', title: 'Photo to mesh', useCases: ['3d'] })
    ])
    expect(screen.getByTestId('shelf-3d')).toBeTruthy()

    await userEvent.click(screen.getByTestId('catalogue-type-model'))
    expect(screen.queryByTestId('shelf-3d')).toBeNull()
  })

  it('opens a shelf into the list for that use case', async () => {
    await at('?type=workflow')
    await userEvent.click(screen.getByTestId('shelf-generate-images-open'))
    expect(shown()).toEqual(['Movie poster'])
    expect(screen.getByTestId('catalogue-heading').textContent).toMatch(
      /image/i
    )
  })

  // A workflow is a graph around a model, so the model is the thing a reader
  // is most likely to be choosing between. The models tab needs no such
  // filter: a model there is the card itself.
  it('offers the model filter on the workflows tab only', async () => {
    await at('', ENTRIES, true)
    expect(screen.queryByTestId('catalogue-model-filter')).toBeNull()

    await userEvent.click(screen.getByTestId('catalogue-type-workflow'))
    expect(screen.getByTestId('catalogue-model-filter')).toBeTruthy()
  })

  // A menu of models longer than the list it narrows costs more than it gives
  // while the catalogue is small, and opening it moves the page. The order is
  // a short fixed list, so it stays.
  it('keeps the model filter out of the way until asked', async () => {
    await at('?type=workflow')

    expect(screen.queryByTestId('catalogue-model-filter')).toBeNull()
    expect(screen.getByTestId('catalogue-sort')).toBeTruthy()
  })

  // A link that already names a model still lands on its workflows, whether or
  // not the control that would have chosen it is on the page.
  it('still answers a link that names a model', async () => {
    await at('?type=workflow&model=Flux')

    expect(shown()).toEqual(['Movie poster'])
  })

  it('narrows the workflows to the model a reader picks', async () => {
    await at(
      '?type=workflow',
      [
        ...ENTRIES,
        workflow({ key: 'cover', title: 'Album cover', models: ['Seedream'] })
      ],
      true
    )

    await userEvent.click(screen.getByTestId('catalogue-model-filter'))
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Flux' }))

    expect(shown()).toEqual(['Movie poster'])
    expect(screen.getByTestId('catalogue-chips').textContent).toMatch(/Flux/)
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
    await at('?type=workflow', [...ENTRIES, ...EDITING])
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
    await at('?type=workflow', [...EDITING, ...videos])

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

  // A row already showing everything it has is a row with nothing behind it,
  // so it offers no way in: opening it would draw the same cards again.
  it('offers no way into a row that is holding nothing back', async () => {
    await at('?type=workflow', [...ENTRIES, ...EDITING])
    await userEvent.click(screen.getByTestId('shelf-edit-images-open'))

    expect(screen.queryByTestId('outcome-upscale-restore-see-all')).toBeNull()
  })

  it('narrows the listing to a row a reader asks to see in full', async () => {
    const crowded = Array.from({ length: 12 }, (_, index) =>
      workflow({
        key: `upscale-${index}`,
        title: `Upscale ${index}`,
        useCases: ['edit-images'],
        tags: ['Image Upscale']
      })
    )
    await at('?type=workflow', [...ENTRIES, ...EDITING, ...crowded])
    await userEvent.click(screen.getByTestId('shelf-edit-images-open'))

    await userEvent.click(screen.getByTestId('outcome-upscale-restore-see-all'))

    expect(shown()).toContain('Upscale a photo')
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

    expect(lastShelf('/hub/model/flux/')).toBe('generate-images')
  })

  // A reader on the shelves has not opened any one shelf, so the way back is
  // the catalogue. Sending them to a filtered list would land them somewhere
  // they have never been, and a stale intent from an earlier list must not be
  // the one that answers.
  it('leaves the catalogue behind for a card opened from a shelf', async () => {
    await at('?type=model&useCase=generate-images')
    await userEvent.click(
      within(screen.getByTestId('catalogue-grid')).getAllByTestId(
        'catalogue-card'
      )[0]
    )

    await at('')
    await userEvent.click(
      within(screen.getByTestId('shelf-generate-images')).getAllByTestId(
        'catalogue-card'
      )[0]
    )

    expect(lastShelf('/hub/model/flux/')).toBe('all')
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
