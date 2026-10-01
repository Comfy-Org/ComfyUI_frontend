import { fireEvent, render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderCutout } from '../../../lib/workshop/background-removal/render-cutout'
import BackgroundRemovalStudio from './BackgroundRemovalStudio.vue'

vi.mock(
  import('../../../lib/workshop/background-removal/render-cutout'),
  () => ({
    renderCutout: vi.fn(() => Promise.resolve('blob:cutout'))
  })
)

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
  vi.mocked(renderCutout).mockClear()
  screenIsWide(true)
})

async function openExample(layout?: string) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(BackgroundRemovalStudio, { props: { layout } })
  await user.click(screen.getByRole('button', { name: 'Try the example' }))
  return user
}

const panel = () =>
  screen.getByRole('complementary', { name: 'Background Removal settings' })
const section = (name: string) => within(panel()).getByRole('region', { name })
const tile = (name: string) =>
  within(section('Background')).getByRole('radio', { name })
const undo = () => screen.getByRole('button', { name: 'Undo' })

describe('BackgroundRemovalStudio', () => {
  it('removes the background from the panel and opens the result on Compare', async () => {
    const user = await openExample()
    expect(tile('Transparent')).toBeChecked()
    expect(undo()).toBeDisabled()

    await user.click(tile('Lilac'))
    await user.click(
      within(section('Format')).getByRole('radio', { name: 'WebP' })
    )
    expect(
      within(panel()).getByRole('button', { name: /^Background\s*Lilac/ })
    ).toBeVisible()

    await user.click(within(panel()).getByTestId('background-removal-run'))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Removing the background…'
    )
    expect(screen.getByRole('status')).toHaveTextContent('0:00 · Lilac WebP')
    await vi.advanceTimersByTimeAsync(3000)

    const download = await screen.findByRole('link', { name: 'Download' })
    expect(download).toHaveAttribute('href', 'blob:cutout')
    expect(download).toHaveAttribute('download', 'potted-plant-cutout.webp')
    expect(vi.mocked(renderCutout)).toHaveBeenCalledWith({
      imageUrl: '/images/apps/background-removal/example.jpg',
      background: 'lilac',
      backgroundColor: '#D9CCF5',
      format: 'webp',
      edgeSoftness: 20,
      seed: 42
    })
    expect(screen.getByRole('button', { name: 'Compare' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(
      screen.getByRole('slider', {
        name: 'Drag to compare the original and the cutout'
      })
    ).toBeVisible()
  })

  it('undoes and redoes a background pick', async () => {
    const user = await openExample()
    await user.click(tile('White'))

    await user.click(undo())
    expect(tile('Transparent')).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Redo' }))
    expect(tile('White')).toBeChecked()
  })

  it('keeps the edge softness and seed in the collapsed Advanced section', async () => {
    const user = await openExample()
    expect(
      within(panel()).queryByRole('slider', { name: 'Edge softness' })
    ).toBeNull()

    await user.click(within(panel()).getByRole('button', { name: /^Advanced/ }))
    const edge = within(section('Advanced')).getByRole('slider', {
      name: 'Edge softness'
    })
    await fireEvent.update(edge, '35')
    await fireEvent.update(edge, '60')

    expect(
      within(panel()).getByRole('button', { name: /^Advanced\s*Edge 60%/ })
    ).toBeVisible()
    await user.click(undo())
    expect(edge).toHaveValue('20')
    expect(
      within(section('Advanced')).getByRole('spinbutton', { name: 'Seed' })
    ).toHaveValue(42)
  })

  it('shows the hint on the photo until a setting is touched', async () => {
    const user = await openExample()
    const hint = 'Pick a background, then run'
    expect(screen.getByTestId('background-removal-stage')).toHaveTextContent(
      hint
    )

    await user.click(tile('White'))

    expect(screen.queryByText(hint)).toBeNull()
  })

  it('cancels a run from the photo and goes back to editing', async () => {
    const user = await openExample()
    await user.click(within(panel()).getByTestId('background-removal-run'))

    await user.click(
      within(screen.getByRole('status')).getByRole('button', { name: 'Cancel' })
    )

    expect(screen.queryByRole('status')).toBeNull()
    expect(tile('Transparent')).toBeEnabled()
  })

  it('goes back to the settings from the result', async () => {
    const user = await openExample()
    await user.click(within(panel()).getByTestId('background-removal-run'))
    await vi.advanceTimersByTimeAsync(3000)

    await user.click(
      await screen.findByRole('button', { name: 'Edit settings' })
    )

    expect(screen.queryByRole('link', { name: 'Download' })).toBeNull()
    expect(tile('Transparent')).toBeEnabled()
  })

  it('opens on phones as a sheet with a summary and the run button', async () => {
    screenIsWide(false)
    const user = await openExample()
    expect(
      within(panel()).getByRole('button', { name: 'Transparent · PNG' })
    ).toHaveAttribute('aria-expanded', 'false')
    expect(within(panel()).getByTestId('background-removal-run')).toBeEnabled()

    await user.click(
      within(panel()).getByRole('button', { name: 'Show all settings' })
    )

    expect(section('Background')).toBeVisible()
  })

  it('keeps the bottom dock and its trays in the bottom composer layout', async () => {
    const user = await openExample('e')
    expect(screen.queryByRole('complementary')).toBeNull()

    await user.click(screen.getByRole('button', { name: /Background/ }))
    const tray = screen.getByRole('dialog', { name: 'Background' })
    await user.click(within(tray).getByRole('radio', { name: 'White' }))

    expect(tray).toHaveTextContent('White')
    expect(undo()).toBeEnabled()
    expect(
      screen.getByRole('toolbar', { name: 'Background Removal tools' })
    ).toContainElement(screen.getByTestId('background-removal-run'))
  })
})
