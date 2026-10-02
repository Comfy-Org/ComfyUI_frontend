import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PaparazziStudio from './PaparazziStudio.vue'

vi.mock(import('../../../lib/workshop/paparazzi-me/render'), () => ({
  renderPaparazziImage: vi.fn(() => Promise.resolve(undefined)),
  renderPaparazziPreview: vi.fn(() => Promise.resolve(undefined)),
  renderSceneThumbnail: vi.fn(() => undefined)
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
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(PaparazziStudio, { props: { layout } })
  return user
}

const panel = () =>
  screen.getByRole('complementary', { name: 'Paparazzi settings' })
const section = (name: string) => within(panel()).getByRole('region', { name })
const faceCard = () => screen.getByRole('region', { name: 'Your face' })

describe('PaparazziStudio', () => {
  it('opens on the example and snaps it from the floating panel', async () => {
    const user = open()
    expect(
      within(faceCard()).getByRole('img', {
        name: 'The example face: a woman with short dark hair'
      })
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()

    await user.click(
      within(section('Scene')).getByRole('radio', { name: 'Café' })
    )
    expect(
      within(section('Scene')).getByRole('radio', { name: 'Café' })
    ).toBeChecked()
    expect(screen.getByRole('button', { name: 'Scene Café' })).toBeVisible()

    await user.click(within(panel()).getByTestId('paparazzi-run'))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Developing the shot…0:00 · Nova Reyes, Café'
    )
    await vi.advanceTimersByTimeAsync(3000)

    expect(
      await screen.findByRole('link', { name: 'Download' })
    ).toHaveAttribute('href', '/images/apps/paparazzi-me/result-cafe.jpg')
    expect(
      screen.getByRole('img', {
        name: 'A paparazzi photo of you next to Nova Reyes'
      })
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Compare' }))
    expect(screen.getByRole('button', { name: 'Compare' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(
      screen.getByRole('slider', {
        name: 'Drag to compare your photo and the paparazzi shot'
      })
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Edit shot' }))
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled()
  })

  it('looks up a star by name and picks one with the keyboard', async () => {
    const user = open()
    const name = within(section('Star')).getByRole('combobox', {
      name: 'Star’s name'
    })

    await user.clear(name)
    expect(
      within(section('Star')).getByText('Type at least 2 letters.')
    ).toBeVisible()
    await user.type(name, 'or')
    const options = within(section('Star')).getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual([
      'OVOrion ValeSinger'
    ])
    await user.keyboard('{Enter}')

    expect(name).toHaveValue('Orion Vale')
    expect(name).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.getByRole('button', { name: 'Star Orion Vale' })
    ).toBeVisible()

    await user.clear(name)
    await user.type(name, 'Zed Nobody')
    expect(
      within(section('Star')).getByText(
        'Not in the list. The model looks them up by name.'
      )
    ).toBeVisible()
    expect(within(panel()).getByTestId('paparazzi-run')).toBeEnabled()
  })

  it('swaps the face for the compact drop card and back to the example', async () => {
    const user = open()
    await user.click(
      within(faceCard()).getByRole('button', { name: 'Remove your face' })
    )

    expect(within(faceCard()).getByText('Add your face')).toBeVisible()
    expect(within(panel()).getByTestId('paparazzi-run')).toBeDisabled()

    await user.click(
      within(faceCard()).getByRole('button', { name: 'Use example' })
    )
    expect(within(panel()).getByTestId('paparazzi-run')).toBeEnabled()
  })

  it('picks the resolution and a new seed in the closed panel sections', async () => {
    const user = open()
    await user.click(
      within(section('Resolution')).getByRole('button', { name: /^Resolution/ })
    )
    await user.click(
      within(section('Resolution')).getByRole('button', {
        name: 'Resolution: 2K'
      })
    )
    await user.click(
      screen.getByRole('menuitemradio', { name: '4K 4096 × 2731 px' })
    )
    expect(
      within(section('Resolution')).getByRole('button', {
        name: 'Resolution: 4K'
      })
    ).toBeVisible()

    await user.click(
      within(section('Advanced')).getByRole('button', { name: /^Advanced/ })
    )
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    await user.click(
      within(section('Advanced')).getByRole('button', { name: 'New seed' })
    )
    expect(
      within(section('Advanced')).getByRole('spinbutton', { name: 'Seed' })
    ).toHaveValue(500_000_000)
  })

  it('snaps from the bottom composer, with Resolution as a pill', async () => {
    const user = open('e')
    expect(screen.queryByRole('complementary')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Resolution: 2K' }))
    await user.click(screen.getByRole('menuitemradio', { name: /^4K/ }))
    expect(screen.getByRole('button', { name: 'Resolution: 4K' })).toBeVisible()

    await user.click(screen.getByTestId('paparazzi-run'))
    expect(screen.queryByRole('dialog')).toBeNull()
    await vi.advanceTimersByTimeAsync(3000)
    expect(await screen.findByRole('link', { name: 'Download' })).toBeVisible()
  })

  it('sums the setup up in the phone sheet', async () => {
    screenIsWide(false)
    const user = open()
    const sheet = panel()
    expect(within(sheet).queryByRole('region', { name: 'Star' })).toBeNull()

    await user.click(
      within(sheet).getByRole('button', {
        name: 'Nova Reyes · Red carpet · 2K'
      })
    )
    expect(within(sheet).getByRole('region', { name: 'Star' })).toBeVisible()
  })
})
