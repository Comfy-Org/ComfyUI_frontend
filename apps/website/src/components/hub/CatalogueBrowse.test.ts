import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import type { BrowseEntry } from '../../lib/hub/browse-entry'
import CatalogueBrowse from './CatalogueBrowse.vue'

function entry(overrides: Partial<BrowseEntry> = {}): BrowseEntry {
  const key = overrides.key ?? 'flux'
  const title = overrides.title ?? 'Flux'
  return {
    key,
    kind: 'model',
    title,
    useCases: ['generate-images'],
    outputs: ['image'],
    provider: 'BFL',
    runsHere: true,
    needsCustomNodes: false,
    models: [],
    tags: [],
    standing: 1,
    date: undefined,
    credits: 10,
    ...overrides,
    card: {
      kind: overrides.kind ?? 'model',
      href: `/playground/model/${key}/`,
      title,
      media: undefined,
      hoverMedia: undefined,
      maker: { label: 'BFL', logo: undefined },
      needsCustomNodes: overrides.needsCustomNodes ?? false,
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
    runsHere: false,
    standing: 400,
    credits: undefined,
    ...overrides
  })

const ENTRIES = [entry(), workflow()]

// A row needs both halves of its answer, so each job below carries a
// capability that does it and a workflow built for it.
const EDITING = [
  entry({
    key: 'seedvr',
    title: 'SeedVR2',
    useCases: ['edit-images'],
    tags: ['Upscale']
  }),
  workflow({
    key: 'upscale-photo',
    title: 'Upscale a photo',
    useCases: ['edit-images'],
    tags: ['Image Upscale']
  }),
  entry({
    key: 'kontext',
    title: 'Flux Kontext',
    useCases: ['edit-images'],
    tags: ['Inpainting']
  }),
  workflow({
    key: 'erase',
    title: 'Erase an object',
    useCases: ['edit-images'],
    tags: ['Inpainting']
  })
]

const shown = () =>
  within(screen.getByTestId('catalogue-grid'))
    .getAllByRole('heading')
    .map((heading) => heading.textContent.trim())

// The URL is read on mount, so the first paint is one tick behind it.
async function at(search: string) {
  window.history.replaceState({}, '', `/playground/${search}`)
  render(CatalogueBrowse, { props: { entries: ENTRIES } })
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

  it('puts a capability before a use of it inside a shelf', async () => {
    await at('')
    const shelf = screen.getByTestId('shelf-generate-images')
    expect(
      within(shelf)
        .getAllByTestId('catalogue-card')
        .map((card) => card.getAttribute('data-kind'))
    ).toEqual(['model', 'workflow'])
  })

  // Every use case has more models than the row holds, so ordering by standing
  // alone would spend all eight slots on models and the shelf would never show
  // what people built.
  it('keeps room on the shelf for what was built on the models', async () => {
    window.history.replaceState({}, '', '/playground/')
    render(CatalogueBrowse, {
      props: {
        entries: [
          ...Array.from({ length: 6 }, (_, index) =>
            entry({ key: `model-${index}`, title: `Model ${index}` })
          ),
          workflow({ key: 'poster', title: 'Movie poster' }),
          workflow({ key: 'banner', title: 'Banner' })
        ]
      }
    })
    await nextTick()

    expect(
      within(screen.getByTestId('shelf-generate-images'))
        .getAllByTestId('catalogue-card')
        .map((card) => card.getAttribute('data-kind'))
    ).toEqual([
      'model',
      'model',
      'model',
      'model',
      'workflow',
      'workflow',
      'model',
      'model'
    ])
  })

  it('opens a shelf into the list for that use case', async () => {
    await at('')
    await userEvent.click(screen.getByTestId('shelf-generate-images-see-all'))
    expect(shown()).toEqual(['Flux', 'Movie poster'])
    expect(screen.getByTestId('catalogue-heading').textContent).toMatch(
      /image/i
    )
  })

  it('opens already narrowed when a model card sent the reader here', async () => {
    await at('?model=Flux')
    expect(shown()).toEqual(['Movie poster'])
    expect(screen.getByTestId('catalogue-chips').textContent).toMatch(/Flux/)
  })

  it('opens on the type the link asked for', async () => {
    await at('?type=workflow')
    expect(shown()).toEqual(['Movie poster'])
  })

  it('keeps only what this site can run', async () => {
    await at('?useCase=generate-images')
    await userEvent.click(screen.getByTestId('catalogue-filter-toggle'))
    await userEvent.selectOptions(
      screen.getByLabelText('What it needs'),
      'runsHere'
    )
    expect(shown()).toEqual(['Flux'])
  })

  it('says so rather than showing an empty grid', async () => {
    await at('?q=nothing-matches-this')
    expect(screen.queryByTestId('catalogue-grid')).toBeNull()
    expect(screen.getByTestId('catalogue-empty')).toBeTruthy()
  })

  // The medium is complete and filters; the job is curated and heads a row, so
  // a model that does everything joins no row and an upscaler joins one.
  it('opens a medium on the rows that name a job inside it', async () => {
    render(CatalogueBrowse, { props: { entries: [...ENTRIES, ...EDITING] } })
    await nextTick()

    await userEvent.click(screen.getByTestId('shelf-edit-images-open'))

    const rows = screen.getByTestId('outcome-rows')
    expect(within(rows).getByText('Upscale and restore')).toBeTruthy()
    expect(within(rows).getByText('Remove and clean up')).toBeTruthy()
    // Flux is in no row: it lists no capability any of these jobs stands for.
    expect(within(rows).queryByText('Flux')).toBeNull()
  })

  it('narrows the listing to a row a reader asks to see in full', async () => {
    render(CatalogueBrowse, { props: { entries: [...ENTRIES, ...EDITING] } })
    await nextTick()
    await userEvent.click(screen.getByTestId('shelf-edit-images-open'))

    await userEvent.click(screen.getByTestId('outcome-upscale-restore-see-all'))

    expect(shown()).toEqual(['SeedVR2', 'Upscale a photo'])
    expect(screen.queryByTestId('outcome-rows')).toBeNull()
    expect(screen.getByTestId('catalogue-chips').textContent).toContain(
      'Upscale and restore'
    )
  })

  // A price order over things that carry no price is a ranking over nothing,
  // so the order follows the type it was chosen for or gives way.
  it('drops a price order when the reader leaves the models behind', async () => {
    await at('?useCase=generate-images')
    const order = screen.getByLabelText('Sort')
    await userEvent.selectOptions(order, 'priceAsc')
    expect(shown()).toEqual(['Flux'])

    await userEvent.click(
      within(screen.getByTestId('catalogue-type-facet')).getByRole('button', {
        name: /everything/i
      })
    )
    expect(shown()).toEqual(['Flux', 'Movie poster'])
    expect(screen.queryByTestId('catalogue-chips')).toBeNull()
  })
})
