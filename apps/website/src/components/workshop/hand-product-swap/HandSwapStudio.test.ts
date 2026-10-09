import { fireEvent, render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import HandSwapStudio from './HandSwapStudio.vue'

vi.mock(import('@/lib/workshop/hand-product-swap/render-swap'), () => ({
  renderSwapImage: vi.fn(() => Promise.resolve(undefined))
}))

function screenIsWide(wide: boolean) {
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches: wide,
    media,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
  }))
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  screenIsWide(true)
})

async function openExample(layout?: string) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(HandSwapStudio, { props: { layout } })
  await user.click(screen.getByRole('button', { name: 'Try the example' }))
  return user
}

const panel = () =>
  screen.getByRole('complementary', { name: 'Hand product swap settings' })
const section = (name: string) => within(panel()).getByRole('region', { name })
const tools = () =>
  screen.getByRole('toolbar', { name: 'Hand product swap tools' })

describe('HandSwapStudio', () => {
  it('swaps the product from the floating panel, then compares the result', async () => {
    const user = await openExample()
    expect(within(tools()).getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Download' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    expect(
      within(section('Product')).getByRole('button', { name: /Product/ })
    ).toHaveTextContent('Can')

    await user.click(
      within(section('Product')).getByRole('radio', { name: 'Serum' })
    )
    await user.click(
      within(panel()).getByRole('button', { name: 'Resolution: 2K' })
    )
    await user.click(screen.getByRole('menuitemradio', { name: /^4K/ }))
    expect(
      within(section('Product')).getByRole('radio', { name: 'Serum' })
    ).toHaveAttribute('aria-checked', 'true')
    expect(within(panel()).getByTestId('swap-run')).toHaveTextContent(
      '25 credits'
    )
    expect(within(tools()).getByRole('button', { name: 'Undo' })).toBeEnabled()

    await user.click(within(panel()).getByTestId('swap-run'))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Swapping the product…'
    )
    expect(screen.getByRole('status')).toHaveTextContent('Queued · Serum · 4K')
    await vi.advanceTimersByTimeAsync(1400)
    expect(screen.getByRole('status')).toHaveTextContent('50% · Serum · 4K')
    await vi.advanceTimersByTimeAsync(3000)

    const download = await screen.findByRole('link', { name: 'Download' })
    expect(download).toHaveAttribute(
      'download',
      'hand-holding-can-swapped-42.jpg'
    )
    expect(download).toHaveAttribute(
      'href',
      '/images/apps/hand-product-swap/result-serum.jpg'
    )
    expect(within(tools()).queryByRole('link')).toBeNull()
    const compare = within(tools()).getByRole('button', { name: 'Compare' })
    expect(compare).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('slider', { name: /Drag to compare/ })).toBeNull()
    expect(
      screen.getByRole('img', { name: 'The hand photo holding your product' })
    ).toHaveAttribute('src', '/images/apps/hand-product-swap/result-serum.jpg')

    await user.click(compare)
    expect(compare).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('slider', {
        name: 'Drag to compare the original and the result'
      })
    ).toBeVisible()

    await user.click(within(tools()).getByRole('button', { name: 'Edit' }))
    expect(screen.getByTestId('swap-stage')).toBeVisible()
  })

  it('has no placement box: the model keeps the hand and grip by itself', async () => {
    await openExample()
    expect(
      screen.queryByRole('button', { name: /Where the product goes/ })
    ).toBeNull()
    expect(screen.queryByRole('button', { name: /box/i })).toBeNull()
    expect(screen.getByText('Same hand & grip, new product')).toBeVisible()
  })

  it.for([
    { layout: 'd', wide: true, names: ['Undo', 'Redo'] },
    { layout: 'd', wide: false, names: ['Undo', 'Redo'] },
    {
      layout: 'e',
      wide: true,
      names: ['Swap product 14 credits', 'Undo', 'Redo']
    }
  ])(
    'keeps undo and redo at the right end of the tools in layout $layout (wide: $wide)',
    async ({ layout, wide, names }) => {
      screenIsWide(wide)
      await openExample(layout)

      const labels = within(tools())
        .getAllByRole('button')
        .map(
          (tool) => tool.getAttribute('aria-label') ?? tool.textContent.trim()
        )
      expect(labels.slice(-names.length)).toEqual(names)
    }
  )

  it('takes a dropped product on the product card and a pasted one anywhere', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:upload')
    const loaded = vi
      .spyOn(HTMLImageElement.prototype, 'src', 'set')
      .mockImplementation(function (this: HTMLImageElement) {
        queueMicrotask(() => this.onload?.(new Event('load')))
      })
    await openExample()
    const bottle = new File(['x'], 'bottle.png', { type: 'image/png' })

    await fireEvent.drop(screen.getByTestId('swap-product-card'), {
      dataTransfer: { files: [bottle] }
    })
    expect(
      await within(section('Product')).findByRole('radio', { name: 'Yours' })
    ).toHaveAttribute('aria-checked', 'true')

    const paste = new Event('paste', { bubbles: true })
    Object.assign(paste, {
      clipboardData: {
        files: [new File(['y'], 'jar.png', { type: 'image/png' })]
      }
    })
    document.dispatchEvent(paste)
    await vi.waitFor(() =>
      expect(screen.getByTestId('swap-product-card')).toHaveTextContent(
        'jar.png'
      )
    )
    loaded.mockRestore()
  })

  it('keeps a shuffleable seed as a row of the panel, with no Advanced section', async () => {
    const user = await openExample()
    expect(
      within(panel())
        .getAllByRole('region')
        .map((region) => region.getAttribute('aria-label'))
    ).toEqual(['Product'])
    const seed = within(panel()).getByRole('spinbutton', { name: 'Seed' })
    expect(seed).toHaveValue(42)

    await user.clear(seed)
    await user.type(seed, '7')
    await user.tab()
    expect(seed).toHaveValue(7)

    vi.spyOn(Math, 'random').mockReturnValue(0.25)
    await user.click(within(panel()).getByRole('button', { name: 'New seed' }))
    expect(seed).toHaveValue(250_000_000)
  })

  it('picks the resolution from a pill in the bottom composer, each size with its pixels', async () => {
    const user = await openExample('e')
    expect(
      screen.queryByRole('complementary', {
        name: 'Hand product swap settings'
      })
    ).toBeNull()

    await user.click(
      within(tools()).getByRole('button', { name: 'Resolution: 2K' })
    )
    await user.click(
      screen.getByRole('menuitemradio', { name: '1K 1024 × 765 px' })
    )
    expect(
      within(tools()).getByRole('button', { name: 'Resolution: 1K' })
    ).toHaveTextContent('1K')
    expect(screen.queryByRole('dialog', { name: 'Resolution' })).toBeNull()
  })

  it('opens on phones as a sheet with a one-line summary and the run button', async () => {
    screenIsWide(false)
    const user = await openExample()
    const summary = within(panel()).getByRole('button', {
      name: 'Can · 2K'
    })
    expect(within(panel()).getByTestId('swap-run')).toBeEnabled()
    expect(
      within(panel()).queryByRole('radiogroup', { name: 'Product' })
    ).toBeNull()

    await user.click(summary)
    expect(
      within(panel()).getByRole('radiogroup', { name: 'Product' })
    ).toBeVisible()
  })
})
