import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import VirtualTryOnStudio from './VirtualTryOnStudio.vue'

vi.mock(import('../../../lib/workshop/virtual-try-on/render-image'), () => ({
  renderTryOn: vi.fn(() => Promise.resolve(undefined))
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

function open(layout?: string) {
  render(VirtualTryOnStudio, { props: { layout } })
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

const panel = () =>
  screen.getByRole('complementary', { name: 'Virtual try-on settings' })
const tools = () =>
  screen.getByRole('toolbar', { name: 'Virtual try-on tools' })

describe('VirtualTryOnStudio', () => {
  it('tries a garment on from the floating panel and compares the result', async () => {
    const user = open()
    expect(
      screen.getByRole('img', { name: 'Garment: Breton tee' })
    ).toBeVisible()
    expect(screen.getByTestId('try-on-outline')).toHaveAttribute(
      'data-fit',
      'regular'
    )

    await user.click(
      within(panel()).getByRole('radio', { name: 'Flannel shirt' })
    )
    await user.click(within(panel()).getByRole('radio', { name: 'Relaxed' }))
    expect(
      screen.getByRole('img', { name: 'Garment: Flannel shirt' })
    ).toBeVisible()
    expect(screen.getByTestId('try-on-outline')).toHaveAttribute(
      'data-fit',
      'relaxed'
    )
    expect(
      within(panel()).getByRole('region', { name: 'Fit' })
    ).toHaveTextContent('Relaxed')

    await user.click(within(panel()).getByTestId('try-on-run'))
    expect(screen.getByRole('status')).toHaveTextContent(
      '0:00 · Flannel shirt, Relaxed fit'
    )
    await vi.advanceTimersByTimeAsync(3000)

    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'download',
      'try-on-motel-balcony.jpg'
    )
    const compare = within(tools()).getByRole('button', { name: 'Compare' })
    expect(compare).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('slider', {
        name: 'Drag to compare the original and the try-on'
      })
    ).toBeVisible()
    await user.click(compare)
    expect(screen.queryByRole('slider')).toBeNull()
    expect(
      screen.getByRole('img', { name: 'The photo with the garment tried on' })
    ).toBeVisible()

    await user.click(within(tools()).getByRole('button', { name: 'Edit' }))
    expect(
      within(panel()).getByRole('radio', { name: 'Relaxed' })
    ).toBeChecked()
  })

  it('undoes a garment change and empties the garment card', async () => {
    const user = open()
    await user.click(within(panel()).getByRole('radio', { name: 'Sage knit' }))
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(
      within(panel()).getByRole('radio', { name: 'Breton tee' })
    ).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Remove garment' }))
    const card = screen.getByRole('complementary', { name: 'Garment' })
    expect(card).toHaveTextContent('Drop a garment photo')
    expect(within(panel()).getByTestId('try-on-run')).toBeDisabled()
    expect(screen.queryByTestId('try-on-outline')).toBeNull()
  })

  it('keeps a shuffleable seed in the collapsed Advanced section', async () => {
    const user = open()
    const advanced = within(panel()).getByRole('button', { name: /^Advanced/ })
    expect(advanced).toHaveTextContent('Seed 7')

    await user.click(advanced)
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    await user.click(within(panel()).getByRole('button', { name: 'New seed' }))

    expect(
      within(panel()).getByRole('spinbutton', { name: 'Seed' })
    ).toHaveValue(500_000_000)
    expect(advanced).toHaveTextContent('Seed 500000000')
  })

  it('sets the fit from a tray in the bottom composer', async () => {
    const user = open('e')
    expect(
      screen.queryByRole('complementary', { name: 'Virtual try-on settings' })
    ).toBeNull()

    await user.click(
      within(tools()).getByRole('button', { name: 'Fit Regular' })
    )
    const tray = screen.getByRole('dialog', { name: 'Fit' })
    await user.click(within(tray).getByRole('radio', { name: 'Slim' }))
    expect(
      within(tools()).getByRole('button', { name: 'Fit Slim' })
    ).toBeVisible()
  })

  it('sums the setup up on the collapsed phone sheet', async () => {
    screenIsWide(false)
    const user = open()
    const sheet = panel()
    expect(within(sheet).queryByRole('region', { name: 'Fit' })).toBeNull()

    await user.click(
      within(sheet).getByRole('button', { name: 'Breton tee · Regular fit' })
    )
    await user.click(within(sheet).getByRole('radio', { name: 'Slim' }))
    await user.click(
      within(sheet).getByRole('button', { name: 'Hide settings' })
    )
    expect(
      within(sheet).getByRole('button', { name: 'Breton tee · Slim fit' })
    ).toBeVisible()
  })
})
