import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PaparazziStudio from './PaparazziStudio.vue'

vi.mock(import('../../../lib/workshop/paparazzi-me/render'), () => ({
  renderPaparazziImage: vi.fn(() => Promise.resolve(undefined))
}))
vi.mock(import('../../../lib/workshop/image-size'), () => ({
  imageSize: vi.fn(() => Promise.resolve({ width: 900, height: 600 }))
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
  vi.spyOn(URL, 'createObjectURL').mockImplementation(
    (file) => `blob:${file instanceof File ? file.name : 'shot'}`
  )
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  screenIsWide(true)
})

function open(layout?: string) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(PaparazziStudio, { props: { layout } })
  return user
}

const panel = () =>
  screen.getByRole('complementary', { name: 'Paparazzi settings' })
const tools = () => screen.getByRole('toolbar', { name: 'Paparazzi tools' })
const sceneRow = () => within(panel()).getByTestId('paparazzi-scene-row')
const picker = () => screen.getByRole('dialog', { name: 'Pick a scene' })
const photo = (name: string) => new File(['x'], name, { type: 'image/jpeg' })

describe('PaparazziStudio', () => {
  it('opens on the example, picks a scene from the grid and inserts the face', async () => {
    const user = open()
    expect(
      screen.getByRole('img', {
        name: 'A paparazzi photo of Nova Reyes: Red carpet'
      })
    ).toHaveAttribute('src', '/images/apps/paparazzi-me/scenes/red-carpet.jpg')
    expect(sceneRow()).toHaveAccessibleName('Scene: Red carpet')

    await user.click(sceneRow())
    expect(
      within(picker()).getByText('Nova Reyes · from Comfy sample library')
    ).toBeVisible()
    const places = within(picker())
      .getAllByRole('radio')
      .map((tile) => tile.textContent.trim())
    expect(places).toEqual([
      'Red carpet',
      'Malibu boardwalk',
      'Cannes yacht',
      'Fashion week',
      'Hotel exit',
      'Farmers market',
      'Ski village',
      'Festival backstage',
      'Gym exit'
    ])
    expect(
      within(picker()).getByRole('button', { name: 'Upload your own scene' })
    ).toBeVisible()

    await user.click(
      within(picker()).getByRole('radio', { name: 'Cannes yacht' })
    )
    expect(screen.queryByRole('dialog', { name: 'Pick a scene' })).toBeNull()
    expect(sceneRow()).toHaveAccessibleName('Scene: Cannes yacht')

    await user.click(within(panel()).getByRole('button', { name: /Insert me/ }))
    expect(screen.getByRole('status')).toHaveTextContent(
      /Queued0:00 · Nova Reyes, Cannes yacht/
    )
    await vi.advanceTimersByTimeAsync(3000)

    expect(
      await screen.findByRole('link', { name: 'Download' })
    ).toHaveAttribute('href', '/images/apps/paparazzi-me/scenes/yacht.jpg')
    await user.click(screen.getByRole('button', { name: 'Compare' }))
    expect(
      screen.getByRole('slider', {
        name: 'Drag to compare the paparazzi photo and your shot'
      })
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Edit shot' }))
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled()
  })

  it.for([
    { layout: 'd', wide: true, tools: ['Undo', 'Redo'] },
    { layout: 'd', wide: false, tools: ['Undo', 'Redo'] },
    { layout: 'e', wide: true, tools: ['Insert me 10 credits', 'Undo', 'Redo'] }
  ])(
    'keeps undo and redo at the right end of the tools in layout $layout (wide: $wide)',
    ({ layout, wide, tools: expected }) => {
      screenIsWide(wide)
      open(layout)

      const names = within(tools())
        .getAllByRole('button')
        .map(
          (tool) => tool.getAttribute('aria-label') ?? tool.textContent.trim()
        )
      expect(names.slice(-expected.length)).toEqual(expected)
    }
  )

  it('looks up a typed star and says what is missing without one', async () => {
    const user = open()
    const name = within(panel()).getByRole('combobox', { name: 'Star’s name' })

    await user.clear(name)
    expect(within(panel()).getByText('Type at least 2 letters.')).toBeVisible()
    expect(within(panel()).getByTestId('paparazzi-run')).toBeDisabled()
    expect(
      within(panel()).getByText('Type a star’s name or upload a scene.')
    ).toBeVisible()

    await user.type(name, 'or')
    await user.keyboard('{Enter}')
    expect(name).toHaveValue('Orion Vale')
    expect(
      within(panel()).getByRole('button', { name: 'Find photos' })
    ).toBeDisabled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(sceneRow()).toHaveAccessibleName('Scene: Red carpet')
    expect(within(panel()).getByTestId('paparazzi-run')).toBeEnabled()
  })

  it('swaps the face and uses an uploaded scene over the look-up', async () => {
    const user = open()
    await user.upload(
      within(panel()).getByTestId('paparazzi-face-input'),
      photo('me.jpg')
    )
    expect(within(panel()).getByText('me.jpg')).toBeVisible()

    await user.click(sceneRow())
    await user.upload(
      within(picker()).getByTestId('paparazzi-scene-input'),
      photo('party.jpg')
    )
    expect(sceneRow()).toHaveAccessibleName('Scene: Your scene')
    expect(screen.getByRole('img', { name: 'Your scene' })).toHaveAttribute(
      'src',
      'blob:party.jpg'
    )
  })

  it('takes a pasted image as the face', async () => {
    open()
    const paste = new Event('paste')
    Object.defineProperty(paste, 'clipboardData', {
      value: { files: [photo('pasted.png')] }
    })
    window.dispatchEvent(paste)
    await vi.advanceTimersByTimeAsync(0)
    expect(within(panel()).getByText('pasted.png')).toBeVisible()
  })

  it('picks the resolution and a new seed from rows of the panel', async () => {
    const user = open()
    await user.click(
      within(panel()).getByRole('button', { name: 'Resolution: 2K' })
    )
    await user.click(
      screen.getByRole('menuitemradio', { name: '4K 4096 × 2731 px' })
    )
    expect(
      within(panel()).getByRole('button', { name: 'Resolution: 4K' })
    ).toBeVisible()

    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    await user.click(within(panel()).getByRole('button', { name: 'New seed' }))
    expect(
      within(panel()).getByRole('spinbutton', { name: 'Seed' })
    ).toHaveValue(500_000_000)
  })

  it('picks a scene from the bottom composer’s tray', async () => {
    const user = open('e')
    expect(screen.queryByRole('complementary')).toBeNull()

    await user.click(screen.getByRole('button', { name: /^Scene/ }))
    const tray = screen.getByRole('dialog', { name: 'Scene' })
    await user.click(within(tray).getByRole('radio', { name: 'Ski village' }))
    expect(screen.getByRole('button', { name: /^Scene/ })).toHaveTextContent(
      'Ski village'
    )

    await user.click(screen.getByTestId('paparazzi-run'))
    await vi.advanceTimersByTimeAsync(3000)
    expect(await screen.findByRole('link', { name: 'Download' })).toBeVisible()
  })

  it('sums the setup up in the phone sheet', async () => {
    screenIsWide(false)
    const user = open()
    await user.click(
      within(panel()).getByRole('button', {
        name: 'Nova Reyes · Red carpet · 2K'
      })
    )
    expect(sceneRow()).toBeVisible()
  })
})
