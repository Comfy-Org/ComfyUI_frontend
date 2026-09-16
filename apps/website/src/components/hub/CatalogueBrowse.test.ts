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
    standing: 1,
    date: undefined,
    credits: 10,
    ...overrides,
    card: {
      kind: overrides.kind ?? 'model',
      href: `/models-v2/model/${key}/`,
      title,
      media: undefined,
      hoverMedia: undefined,
      maker: { label: 'BFL', logo: undefined },
      action: 'run',
      price: undefined,
      crossing: undefined,
      needsCustomNodes: overrides.needsCustomNodes ?? false,
      tags: [],
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

const shown = () =>
  within(screen.getByTestId('catalogue-grid'))
    .getAllByRole('heading')
    .map((heading) => heading.textContent.trim())

// The URL is read on mount, so the first paint is one tick behind it.
async function at(search: string) {
  window.history.replaceState({}, '', `/models-v2/${search}`)
  render(CatalogueBrowse, { props: { entries: ENTRIES } })
  await nextTick()
}

describe('CatalogueBrowse', () => {
  afterEach(() => window.history.replaceState({}, '', '/models-v2/'))

  it('leads with capabilities and follows with what is built on them', async () => {
    await at('')
    expect(shown()).toEqual(['Flux', 'Movie poster'])
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
    await at('')
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

  // A price order over things that carry no price is a ranking over nothing,
  // so the order follows the type it was chosen for or gives way.
  it('drops a price order when the reader leaves the models behind', async () => {
    await at('')
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
