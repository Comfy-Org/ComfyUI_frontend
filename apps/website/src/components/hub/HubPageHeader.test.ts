import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import HubPageHeader from './HubPageHeader.vue'

const LEAD =
  'Generate a new video by feeding MiniMax H3 a reference image, up to nine images, three videos, and three audio clips alongside a text prompt.'

/**
 * Text has no height of its own under happy-dom, and the header measures the
 * summary as it mounts, so how far it runs past two lines is set beforehand.
 */
async function summaryRunning(lines: number) {
  for (const [name, value] of [
    ['clientHeight', 40],
    ['scrollHeight', lines * 20]
  ] as const)
    vi.spyOn(HTMLElement.prototype, name, 'get').mockReturnValue(value)
  render(HubPageHeader, { props: props({ summary: LEAD }) })
  await nextTick()
}

const props = (overrides = {}) => ({
  eyebrow: 'Black Forest Labs',
  title: 'FLUX 2 Pro',
  tags: [],
  ...overrides
})

const tags = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    label: `tag-${index}`,
    href: `/hub/?q=tag-${index}`
  }))

describe('HubPageHeader', () => {
  // A lead written for a model page runs six or seven lines here, which pushes
  // the tabs under it off the screen.
  it('keeps a long description to two lines until it is asked for', async () => {
    await summaryRunning(7)

    expect(screen.getByText(LEAD).className).toContain('line-clamp-2')

    await userEvent.click(screen.getByTestId('hub-header-summary-toggle'))

    expect(screen.getByText(LEAD).className).not.toContain('line-clamp-2')
  })

  it('offers nothing to open on a description that already fits', async () => {
    await summaryRunning(2)

    expect(screen.queryByTestId('hub-header-summary-toggle')).toBeNull()
  })

  // A model's provider is a name; a workflow's is the model it runs on, which
  // is a page. The header carries whichever it was given without the caller
  // having to ask for a different shape.
  it.for([
    ['opens the eyebrow it was given a destination for', '/hub/model/flux/'],
    ['states an eyebrow that goes nowhere', undefined]
  ] as const)('%s', ([, eyebrowHref]) => {
    render(HubPageHeader, { props: props({ eyebrowHref }) })
    const eyebrow = screen.getByTestId('hub-header-eyebrow')

    expect(eyebrow.textContent).toContain('Black Forest Labs')
    expect(eyebrow.getAttribute('href')).toBe(eyebrowHref ?? null)
  })

  // Past three, the row wraps under the price and reads as a paragraph.
  it('shows three tags and folds the rest behind a count', () => {
    render(HubPageHeader, { props: props({ tags: tags(5) }) })
    const row = screen.getByTestId('hub-header-tags')

    expect(within(row).getAllByRole('link')).toHaveLength(3)
    expect(within(row).getByTestId('model-tags-rest').textContent).toContain(
      '+2'
    )
  })

  it('offers no fold when every tag is already shown', () => {
    render(HubPageHeader, { props: props({ tags: tags(3) }) })

    expect(screen.queryByTestId('model-tags-rest')).toBeNull()
  })

  it('leaves out the tag row and the use case it has nothing for', () => {
    render(HubPageHeader, { props: props() })

    expect(screen.queryByTestId('hub-header-tags')).toBeNull()
    expect(screen.queryByTestId('hub-header-use-case')).toBeNull()
  })

  // Every page here can be run, so the header always says what a run costs —
  // naming the settings when the price depends on them.
  it.for([
    ['~9.5 credits/image', /9\.5/],
    [undefined, /depends/i]
  ] as const)('states the cost %s', ([price, shown]) => {
    render(HubPageHeader, { props: props({ price }) })

    expect(screen.getByTestId('model-price').textContent).toMatch(shown)
  })
})
