import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import HandSwapStudio from './HandSwapStudio.vue'

vi.mock(import('../../../lib/workshop/hand-product-swap/render-swap'), () => ({
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
const box = () =>
  screen.getByRole('button', { name: /^Where the product goes/ })

describe('HandSwapStudio', () => {
  it('swaps the product from the floating panel, then compares the result', async () => {
    const user = await openExample()
    expect(within(tools()).getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(
      within(section('Product')).getByRole('button', { name: /Product/ })
    ).toHaveTextContent('Can')

    await user.click(
      within(section('Product')).getByRole('radio', { name: 'Serum' })
    )
    await user.click(
      within(section('Resolution')).getByRole('radio', { name: '4K' })
    )
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
    expect(screen.getByRole('status')).toHaveTextContent('Serum · 4K')
    await vi.advanceTimersByTimeAsync(3000)

    expect(
      await screen.findByRole('link', { name: 'Download' })
    ).toHaveAttribute('download', 'swapped-hand-holding-can.jpg')
    const compare = within(tools()).getByRole('button', { name: 'Compare' })
    expect(compare).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('slider', {
        name: 'Drag to compare the original and the result'
      })
    ).toBeVisible()

    await user.click(compare)
    expect(compare).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('slider', { name: /Drag to compare/ })).toBeNull()

    await user.click(within(tools()).getByRole('button', { name: 'Edit' }))
    expect(box()).toBeVisible()
  })

  it('nudges the box with the arrow keys and undoes it', async () => {
    const user = await openExample()
    const left = parseFloat(box().style.left)
    box().focus()
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(parseFloat(box().style.left)).toBeCloseTo(left + 5)

    await user.click(within(tools()).getByRole('button', { name: 'Undo' }))
    expect(parseFloat(box().style.left)).toBeCloseTo(left)
  })

  it('keeps the seed in a closed Advanced section that shows it', async () => {
    const user = await openExample()
    const advanced = within(section('Advanced')).getByRole('button', {
      name: /Advanced/
    })
    expect(advanced).toHaveAttribute('aria-expanded', 'false')
    expect(advanced).toHaveTextContent('Seed 42')

    await user.click(advanced)
    const seed = within(section('Advanced')).getByRole('spinbutton', {
      name: 'Seed'
    })
    await user.clear(seed)
    await user.type(seed, '7')
    await user.tab()
    expect(advanced).toHaveTextContent('Seed 7')
  })

  it('opens each setting as a tray from the bottom composer', async () => {
    const user = await openExample('e')
    expect(
      screen.queryByRole('complementary', {
        name: 'Hand product swap settings'
      })
    ).toBeNull()

    await user.click(
      within(tools()).getByRole('button', { name: /Resolution/ })
    )
    const tray = screen.getByRole('dialog', { name: 'Resolution' })
    await user.click(within(tray).getByRole('radio', { name: '1K' }))
    expect(
      within(tools()).getByRole('button', { name: /Resolution/ })
    ).toHaveTextContent('1K')
    expect(within(tray).getByText('1024 × 768 px')).toBeVisible()
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
