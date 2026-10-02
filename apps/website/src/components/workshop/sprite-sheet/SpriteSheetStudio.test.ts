import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SpriteSheetStudio from './SpriteSheetStudio.vue'

vi.mock(import('../../../lib/workshop/sprite-sheet/render-sheet'), () => ({
  renderSpriteSheet: vi.fn((_url: string, _setup: unknown, plain?: boolean) =>
    Promise.resolve(plain ? 'blob:plain' : 'blob:sheet')
  ),
  renderStyleThumbnails: vi.fn(() => Promise.resolve(undefined))
}))

function screenIsWide(wide: boolean) {
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches: wide && !media.includes('reduced-motion'),
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
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  screenIsWide(true)
})

async function openExample(layout?: string) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(SpriteSheetStudio, { props: { layout } })
  await user.click(screen.getByRole('button', { name: 'Try the example' }))
  return user
}

const panel = () =>
  screen.getByRole('complementary', { name: 'Sprite sheet settings' })
const tools = () => screen.getByRole('toolbar', { name: 'Sprite sheet tools' })

async function makeSheet(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByTestId('sprite-run')[0])
  expect(screen.getByRole('status')).toHaveTextContent('Drawing the frames')
  await vi.advanceTimersByTimeAsync(3000)
  await screen.findByRole('link', { name: 'Download' })
}

describe('SpriteSheetStudio', () => {
  it('picks a style and a motion from the panel, then makes the sheet', async () => {
    const user = await openExample()
    expect(screen.getByRole('button', { name: 'Download' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    const style = within(panel()).getByRole('region', { name: 'Style' })
    const motion = within(panel()).getByRole('region', { name: 'Motion' })

    await user.click(within(style).getByRole('radio', { name: 'Toon' }))
    await user.click(within(motion).getByRole('radio', { name: 'Jump' }))
    expect(within(style).getByRole('radio', { name: 'Toon' })).toBeChecked()
    expect(
      within(panel()).getByRole('button', { name: /Advanced\s*8 frames/ })
    ).toBeInTheDocument()

    await makeSheet(user)

    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'href',
      'blob:sheet'
    )
    expect(within(tools()).queryByRole('link')).toBeNull()
    expect(screen.getByRole('img', { name: /8 frames of Jump in Toon/ })).toBe(
      screen.getByTestId('sprite-sheet-result')
    )
  })

  it('sets the frame count and a new seed under Advanced', async () => {
    const user = await openExample()
    const advanced = within(panel()).getByRole('region', { name: 'Advanced' })
    await user.click(
      within(advanced).getByRole('button', { name: /^Advanced/ })
    )

    await user.click(
      within(advanced).getByRole('button', { name: 'Frames: 8 frames' })
    )
    await user.click(screen.getByRole('menuitemradio', { name: '12 frames' }))
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    await user.click(within(advanced).getByRole('button', { name: 'New seed' }))

    expect(
      within(advanced).getByRole('spinbutton', { name: 'Seed' })
    ).toHaveValue(500_000_000)
    expect(
      within(panel()).getByRole('button', {
        name: /Advanced\s*12 frames · Seed 500000000/
      })
    ).toBeInTheDocument()
  })

  it.for([
    { layout: 'd', wide: true, last: 'Onion skin' },
    { layout: 'd', wide: false, last: 'Onion skin' },
    { layout: 'e', wide: true, last: 'Make sheet 30 credits' }
  ])(
    'keeps undo and redo at the right end of the tools in layout $layout (wide: $wide)',
    async ({ layout, wide, last }) => {
      screenIsWide(wide)
      await openExample(layout)

      const names = within(tools())
        .getAllByRole('button')
        .map(
          (tool) => tool.getAttribute('aria-label') ?? tool.textContent.trim()
        )
      expect(names.slice(-3)).toEqual([last, 'Undo', 'Redo'])
    }
  )

  it('undoes a style change from the control pill', async () => {
    const user = await openExample()
    const style = within(panel()).getByRole('region', { name: 'Style' })
    await user.click(within(style).getByRole('radio', { name: '3D' }))

    await user.click(within(tools()).getByRole('button', { name: 'Undo' }))

    expect(within(style).getByRole('radio', { name: 'Pixel' })).toBeChecked()
  })

  it('pauses the preview on a frame picked on the sheet', async () => {
    const user = await openExample()
    await user.click(screen.getByRole('button', { name: 'Pause' }))

    await user.click(
      screen.getByRole('button', { name: 'Show frame 3 in the preview' })
    )

    expect(screen.getByTestId('sprite-preview')).toHaveTextContent('3 / 8')
    expect(
      screen.getByRole('button', { name: 'Show frame 3 in the preview' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  it('compares the character and the sheet on a split line', async () => {
    const user = await openExample()
    await makeSheet(user)

    await user.click(within(tools()).getByRole('button', { name: 'Compare' }))

    expect(
      screen.getByRole('slider', {
        name: 'Drag to compare the character and the sprite sheet'
      })
    ).toBeInTheDocument()
    expect(screen.getByText('Original')).toBeInTheDocument()
    expect(screen.getByText('Result')).toBeInTheDocument()
  })

  it('opens the settings as trays in the bottom composer', async () => {
    const user = await openExample('e')
    expect(screen.queryByRole('complementary')).toBeNull()

    await user.click(within(tools()).getByRole('button', { name: /Motion/ }))
    const tray = screen.getByRole('dialog', { name: 'Motion' })
    await user.click(within(tray).getByRole('radio', { name: 'Idle' }))

    expect(
      within(tools()).getByRole('button', { name: /Motion\s*Idle/ })
    ).toBeInTheDocument()
  })

  it('sums up the setup in the phone sheet', async () => {
    screenIsWide(false)
    await openExample()

    expect(
      within(panel()).getByRole('button', { name: 'Pixel · Walk · 8 frames' })
    ).toBeInTheDocument()
  })
})
