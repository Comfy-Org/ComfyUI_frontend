import { fireEvent, render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderSpriteSheet } from '../../../lib/workshop/sprite-sheet/render-sheet'
import SpriteSheetStudio from './SpriteSheetStudio.vue'

vi.mock(import('../../../lib/workshop/sprite-sheet/render-sheet'), () => ({
  renderSpriteSheet: vi.fn(() => Promise.resolve('blob:sheet')),
  renderStyleThumbnails: vi.fn(() => Promise.resolve(undefined))
}))

vi.mock(import('../../../lib/workshop/image-size'), () => ({
  imageSize: vi.fn(() => Promise.resolve({ width: 64, height: 64 }))
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
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:upload')
  vi.mocked(renderSpriteSheet).mockClear()
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

async function generate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByTestId('sprite-run')[0])
  expect(screen.getByRole('status')).toHaveTextContent('Queued')
  await vi.advanceTimersByTimeAsync(1000)
  expect(screen.getByRole('status')).toHaveTextContent(/\d+% · /)
  await vi.advanceTimersByTimeAsync(2000)
  await screen.findByRole('link', { name: 'Download' })
}

describe('SpriteSheetStudio', () => {
  it('describes the animation, picks a style and a motion from picker rows, then generates the sheet', async () => {
    const user = await openExample()
    expect(screen.getByRole('button', { name: 'Download' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    await user.type(
      within(panel()).getByRole('textbox', { name: 'Animation' }),
      'dancing'
    )
    await user.click(within(panel()).getByRole('button', { name: /Style/ }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Style' })).getByRole('radio', {
        name: 'Toon'
      })
    )
    await user.click(within(panel()).getByRole('button', { name: /Motion/ }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Motion' })).getByRole(
        'radio',
        { name: 'Jump' }
      )
    )
    expect(
      within(panel()).getByRole('button', { name: 'Style: Toon' })
    ).toHaveAttribute('aria-haspopup', 'dialog')

    await generate(user)

    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'download',
      'fox-explorer-toon-jump-sheet.png'
    )
    expect(screen.getByRole('img', { name: /8 frames of Jump in Toon/ })).toBe(
      screen.getByTestId('sprite-sheet-result')
    )
    expect(renderSpriteSheet).toHaveBeenCalledWith(
      '/images/apps/sprite-sheet/example.png',
      expect.objectContaining({
        description: 'dancing',
        style: 'toon',
        motion: 'jump'
      })
    )
  })

  it('keeps the seed a direct row of the panel, with no frame count to pick', async () => {
    const user = await openExample()
    expect(within(panel()).queryByRole('button', { name: /Frames/ })).toBeNull()

    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    await user.click(within(panel()).getByRole('button', { name: 'New seed' }))

    expect(
      within(panel()).getByRole('spinbutton', { name: 'Seed' })
    ).toHaveValue(500_000_000)
  })

  it('undoes typing in the animation as one step from the control pill', async () => {
    const user = await openExample()
    const animation = within(panel()).getByRole('textbox', {
      name: 'Animation'
    })
    await user.type(animation, 'soft blink')

    await user.click(within(tools()).getByRole('button', { name: 'Undo' }))

    expect(animation).toHaveValue('')
  })

  it('plays the frames in Preview and stops on a frame picked on the Sheet', async () => {
    const user = await openExample()
    expect(within(tools()).queryByRole('button', { name: 'Pause' })).toBeNull()

    await user.click(
      screen.getByRole('button', { name: 'Show frame 3 in the preview' })
    )

    expect(
      within(tools()).getByRole('radio', { name: 'Preview' })
    ).toBeChecked()
    expect(screen.getByTestId('sprite-preview-frame')).toHaveTextContent(
      '3 / 8'
    )
    expect(
      within(tools()).getByRole('button', { name: 'Play' })
    ).toBeInTheDocument()

    await user.click(within(tools()).getByRole('radio', { name: 'Sheet' }))
    expect(screen.getByTestId('sprite-stage')).toBeInTheDocument()
  })

  it('replaces the character with an image pasted from the clipboard', async () => {
    await openExample()
    const file = new File(['png'], 'knight.png', { type: 'image/png' })

    await fireEvent(
      window,
      Object.assign(new Event('paste'), {
        clipboardData: { files: [file] }
      })
    )

    expect(await within(panel()).findByText('knight.png')).toBeInTheDocument()
  })

  it('replaces the character with an image dropped on its row', async () => {
    await openExample()
    const file = new File(['png'], 'robot.png', { type: 'image/png' })

    await fireEvent.drop(screen.getByTestId('sprite-character'), {
      dataTransfer: { files: [file] }
    })

    expect(await within(panel()).findByText('robot.png')).toBeInTheDocument()
  })

  it('opens every setting as a tray in the bottom composer', async () => {
    const user = await openExample('e')
    expect(screen.queryByRole('complementary')).toBeNull()

    await user.click(within(tools()).getByRole('button', { name: /Motion/ }))
    const tray = screen.getByRole('dialog', { name: 'Motion' })
    await user.click(within(tray).getByRole('radio', { name: 'Idle' }))
    await user.click(within(tools()).getByRole('button', { name: /Animation/ }))
    await user.type(
      within(screen.getByRole('dialog', { name: 'Animation' })).getByRole(
        'textbox'
      ),
      'waving'
    )

    expect(
      within(tools()).getByRole('button', { name: /Motion\s*Idle/ })
    ).toBeInTheDocument()
    expect(
      within(tools()).getByRole('button', { name: /Animation\s*waving/ })
    ).toBeInTheDocument()
  })

  it('unfolds the style grid inside the phone sheet', async () => {
    screenIsWide(false)
    const user = await openExample()

    await user.click(
      within(panel()).getByRole('button', { name: 'Pixel · Walk · 8 frames' })
    )
    await user.click(within(panel()).getByRole('button', { name: /Style/ }))

    expect(screen.queryByRole('dialog', { name: 'Style' })).toBeNull()
    expect(
      within(panel()).getByRole('radiogroup', { name: 'Style' })
    ).toBeInTheDocument()
  })
})
