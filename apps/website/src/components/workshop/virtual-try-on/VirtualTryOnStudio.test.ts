import { fireEvent, render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import VirtualTryOnStudio from './VirtualTryOnStudio.vue'

vi.mock(import('../../../lib/workshop/virtual-try-on/render-image'), () => ({
  renderTryOn: vi.fn(() => Promise.resolve(undefined))
}))

vi.mock(import('../../../lib/workshop/image-size'), () => ({
  imageSize: vi.fn(() => Promise.resolve({ width: 600, height: 800 }))
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
    expect(screen.getByRole('button', { name: 'Download' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    expect(
      within(panel()).getByRole('radio', { name: 'Regular' })
    ).toBeChecked()

    await user.click(
      within(panel()).getByRole('radio', { name: 'Flannel shirt' })
    )
    await user.click(within(panel()).getByRole('radio', { name: 'Relaxed' }))
    expect(
      screen.getByRole('img', { name: 'Garment: Flannel shirt' })
    ).toBeVisible()

    await user.click(within(panel()).getByTestId('try-on-run'))
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Queued…')
    expect(status).toHaveTextContent('0:00 · Flannel shirt, Relaxed fit')
    await vi.advanceTimersByTimeAsync(1400)
    expect(status).toHaveTextContent(/Trying it on · \d+%/)
    await vi.advanceTimersByTimeAsync(1600)

    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'download',
      'try-on-motel-balcony.jpg'
    )
    expect(within(tools()).queryByRole('link')).toBeNull()
    const compare = within(tools()).getByRole('button', { name: 'Compare' })
    expect(compare).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('slider')).toBeNull()
    expect(
      screen.getByRole('img', { name: 'The photo with the garment tried on' })
    ).toHaveAttribute('src', '/images/apps/virtual-try-on/result-flannel.jpg')
    await user.click(compare)
    expect(
      screen.getByRole('slider', {
        name: 'Drag to compare the original and the try-on'
      })
    ).toBeVisible()

    await user.click(within(tools()).getByRole('button', { name: 'Edit' }))
    expect(
      within(panel()).getByRole('radio', { name: 'Relaxed' })
    ).toBeChecked()
  })

  it.for([
    { layout: 'd', wide: true, tools: ['Undo', 'Redo'] },
    { layout: 'd', wide: false, tools: ['Undo', 'Redo'] },
    { layout: 'e', wide: true, tools: ['Try it on 8 credits', 'Undo', 'Redo'] }
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

  it('undoes a garment change and empties the garment card', async () => {
    const user = open()
    await user.click(within(panel()).getByRole('radio', { name: 'Sage knit' }))
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(
      within(panel()).getByRole('radio', { name: 'Breton tee' })
    ).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Remove garment' }))
    const card = screen.getByRole('complementary', { name: 'Garment' })
    expect(card).toHaveTextContent('Drop or paste a garment photo')
    const run = within(panel()).getByTestId('try-on-run')
    expect(run).toBeDisabled()
    expect(run).toHaveTextContent('Upload a garment')
  })

  it.for([
    {
      name: 'pastes a garment from the clipboard',
      send: (data: DataTransfer, user: UserEvent) => user.paste(data)
    },
    {
      name: 'drops a garment on the garment picker',
      send: (data: DataTransfer) =>
        fireEvent.drop(screen.getByTestId('try-on-garment-drop'), {
          dataTransfer: data
        })
    },
    {
      name: 'drops a garment on the garment card',
      send: (data: DataTransfer) =>
        fireEvent.drop(
          screen.getByRole('img', { name: 'Garment: Breton tee' }),
          { dataTransfer: data }
        )
    }
  ])('$name', async ({ send }) => {
    const user = open()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:shirt')
    const data = new DataTransfer()
    data.items.add(new File(['x'], 'shirt.png', { type: 'image/png' }))

    await send(data, user)

    expect(
      screen.getByRole('img', { name: 'Garment: shirt.png' })
    ).toHaveAttribute('src', 'blob:shirt')
    expect(
      within(panel()).getByRole('radio', { name: 'shirt.png' })
    ).toBeChecked()
  })

  it.for([
    { name: 'the photo', target: () => screen.getByTestId('try-on-person') },
    {
      name: 'the person row',
      target: () => within(panel()).getByTestId('try-on-person-row')
    }
  ])('drops a person on $name', async ({ target }) => {
    open()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:me')
    const data = new DataTransfer()
    data.items.add(new File(['x'], 'me.jpg', { type: 'image/jpeg' }))

    await fireEvent.drop(target(), { dataTransfer: data })

    expect(await screen.findByRole('img', { name: 'me.jpg' })).toHaveAttribute(
      'src',
      'blob:me'
    )
    expect(within(panel()).getByText('me.jpg')).toBeVisible()
  })

  it('keeps a shuffleable seed as a row of the panel', async () => {
    const user = open()
    const seed = within(panel()).getByRole('spinbutton', { name: 'Seed' })
    expect(seed).toHaveValue(7)
    expect(
      within(panel()).queryByRole('button', { name: /^Advanced/ })
    ).toBeNull()

    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    await user.click(within(panel()).getByRole('button', { name: 'New seed' }))

    expect(seed).toHaveValue(500_000_000)
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
    expect(within(sheet).queryByRole('radiogroup', { name: 'Fit' })).toBeNull()

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
