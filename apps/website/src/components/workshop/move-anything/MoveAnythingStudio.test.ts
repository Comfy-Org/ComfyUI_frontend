import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MoveAnythingStudio from './MoveAnythingStudio.vue'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

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

async function openExample(layout?: string) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(MoveAnythingStudio, { props: { layout } })
  await user.click(screen.getByRole('button', { name: 'Try the example' }))
  expect(screen.getByRole('status')).toHaveTextContent('Detecting…')
  await vi.advanceTimersByTimeAsync(700)
  return user
}

async function openUpload() {
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = 800
      naturalHeight = 600
      onload?: () => void
      set src(_url: string) {
        queueMicrotask(() => this.onload?.())
      }
    }
  )
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(MoveAnythingStudio)
  await user.upload(
    screen.getByTestId('editor-empty-file'),
    new File(['x'], 'photo.png', { type: 'image/png' })
  )
  await screen.findByTestId('move-stage')
  return user
}

const panel = () =>
  screen.getByRole('complementary', { name: 'Move anything settings' })

function stageAt1000x600() {
  const stage = screen.getByTestId('move-stage')
  vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 600)
  )
  return stage
}

const kitten = () => screen.getByRole('button', { name: /^Orange kitten\./ })

describe('MoveAnythingStudio', () => {
  it('moves a thing in the example, waits, then offers the result', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(MoveAnythingStudio, { props: { layout: 'e' } })
    expect(screen.queryByTestId('move-generate')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Try the example' }))
    const generate = screen.getByTestId('move-generate')
    expect(generate).toBeDisabled()
    await vi.advanceTimersByTimeAsync(700)
    kitten().focus()
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(generate).toHaveTextContent('Move 1 object')
    expect(screen.getByTestId('move-ghost')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quality: Fast' }))
    await user.click(screen.getByRole('menuitemradio', { name: /^Best/ }))

    await user.click(generate)
    expect(screen.getByRole('status')).toHaveTextContent('Making the move')
    expect(screen.getByRole('status')).toHaveTextContent('About a minute')
    await vi.runAllTimersAsync()

    expect(
      await screen.findByRole('link', { name: 'Download' })
    ).toHaveAttribute('href', '/images/apps/move-anything/example-moved.jpg')
  })

  it.for([
    { layout: 'e', how: 'the × on its chip' },
    { layout: 'd', how: 'the × on its chip' },
    { layout: 'e', how: 'Delete' },
    { layout: 'd', how: 'Backspace' }
  ])(
    'removes the selected thing in layout $layout with $how, and undoes it',
    async ({ layout, how }) => {
      screenIsWide(true)
      const user = await openExample(layout)
      expect(
        screen.queryByRole('button', { name: 'Remove Orange kitten' })
      ).toBeNull()

      kitten().focus()
      if (how === 'Delete' || how === 'Backspace')
        await user.keyboard(`{${how}}`)
      else
        await user.click(
          await screen.findByRole('button', { name: 'Remove Orange kitten' })
        )

      expect(
        screen.queryByRole('button', { name: /^Orange kitten\./ })
      ).toBeNull()
      expect(screen.getAllByTestId('move-object-chip')).toHaveLength(2)
      await user.click(screen.getByRole('button', { name: 'Undo' }))
      expect(kitten()).toBeVisible()
    }
  )

  it('keeps the tools as icons named for assistive tech, with no Objects list or tray', async () => {
    screenIsWide(true)
    await openExample()
    const tools = screen.getByRole('toolbar', { name: 'Move anything tools' })

    for (const name of ['Move', 'Smart select', 'Box select'])
      expect(within(tools).getByRole('button', { name })).toHaveTextContent(
        /^$/
      )
    expect(screen.queryByRole('list', { name: 'Objects' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Objects/ })).toBeNull()
  })

  it('undoes and redoes a move from the history controls, but never the detection', async () => {
    const user = await openExample('e')
    const history = screen.getByRole('group', { name: 'History' })
    const undo = within(history).getByRole('button', { name: 'Undo' })
    const generate = screen.getByTestId('move-generate')
    expect(undo).toBeDisabled()

    kitten().focus()
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    await user.click(undo)
    expect(generate).toBeDisabled()
    expect(undo).toBeDisabled()
    expect(screen.getAllByTestId('move-outline')).toHaveLength(3)

    await user.click(within(history).getByRole('button', { name: 'Redo' }))
    expect(generate).toHaveTextContent('Move 1 object')
  })

  it('shows the how-to hint on the photo until a thing is touched', async () => {
    const user = await openExample('e')
    const hint = 'Drag a thing to move it'

    expect(screen.getByText(hint)).toBeInTheDocument()
    kitten().focus()
    await user.keyboard('{ArrowRight}')

    expect(screen.queryByText(hint)).toBeNull()
  })

  it('detects the example things and moves one from the side panel layout, with its tools floating over the photo', async () => {
    screenIsWide(true)
    const user = await openExample()
    expect(panel()).toHaveTextContent('kitten.jpg')
    expect(panel()).toHaveTextContent('1043 × 693')
    const tools = screen.getByRole('toolbar', { name: 'Move anything tools' })
    expect(
      within(tools).getByRole('group', { name: 'History' })
    ).toContainElement(screen.getByRole('button', { name: 'Undo' }))
    expect(within(tools).getByRole('button', { name: 'Move' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getAllByTestId('move-outline')).toHaveLength(3)
    const chips = screen.getAllByTestId('move-object-chip')
    expect(chips.map((chip) => chip.textContent.trim())).toEqual([
      '1Orange kitten',
      '2Succulent',
      '3Succulent'
    ])
    const generate = within(panel()).getByTestId('move-generate')
    expect(generate).toBeDisabled()

    kitten().focus()
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(generate).toHaveTextContent('Move 1 object')
    await user.click(
      within(panel()).getByRole('button', { name: 'Quality: Fast' })
    )
    await user.click(screen.getByRole('menuitemradio', { name: /^Best/ }))
    expect(
      within(panel()).getByRole('button', { name: 'Quality: Best' })
    ).toBeVisible()
    await user.click(generate)
    expect(screen.getByRole('status')).toHaveTextContent('About a minute')
    await vi.advanceTimersByTimeAsync(3000)

    expect(
      await screen.findByRole('link', { name: 'Download' })
    ).toHaveAttribute('href', '/images/apps/move-anything/example-moved.jpg')
  })

  it('starts an uploaded photo with Smart select and selects a clicked thing', async () => {
    screenIsWide(true)
    const user = await openUpload()
    const tools = screen.getByRole('toolbar', { name: 'Move anything tools' })
    expect(
      within(tools).getByRole('button', { name: 'Smart select' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Click a thing to select it')).toBeInTheDocument()

    await user.pointer({
      keys: '[MouseLeft]',
      target: stageAt1000x600(),
      coords: { clientX: 500, clientY: 300 }
    })
    expect(screen.getByRole('status')).toHaveTextContent('Detecting…')
    await vi.advanceTimersByTimeAsync(600)

    expect(screen.getByRole('button', { name: /^Object 1\./ })).toBeVisible()
    expect(within(tools).getByRole('button', { name: 'Move' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByText(/^Drag to move/)).toBeInTheDocument()
  })

  it('adds a box drawn with Box select on an uploaded photo', async () => {
    screenIsWide(true)
    const user = await openUpload()
    await user.click(screen.getByRole('button', { name: 'Box select' }))
    expect(screen.getByText('Draw a box around a thing')).toBeInTheDocument()
    const stage = stageAt1000x600()

    await user.pointer([
      {
        keys: '[MouseLeft>]',
        target: stage,
        coords: { clientX: 280, clientY: 318 }
      },
      { target: stage, coords: { clientX: 430, clientY: 468 } },
      { keys: '[/MouseLeft]', target: stage }
    ])

    expect(screen.getByRole('button', { name: /^Object 1\./ })).toBeVisible()
    expect(screen.getByTestId('move-object-chip')).toHaveTextContent('Object 1')
  })

  it('renames a thing by double-clicking its chip on the photo, and undoes it', async () => {
    screenIsWide(true)
    const user = await openExample()

    await user.dblClick(screen.getAllByTestId('move-object-chip')[0])
    const field = screen.getByRole('textbox', { name: 'Rename Orange kitten' })
    await user.clear(field)
    await user.type(field, 'Ginger{Enter}')

    expect(screen.getByRole('button', { name: /^Ginger\./ })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(kitten()).toBeVisible()
  })

  it('renames a focused thing with F2 and keeps the name on Escape', async () => {
    screenIsWide(true)
    const user = await openExample()

    kitten().focus()
    await user.keyboard('{F2}')
    await user.type(
      screen.getByRole('textbox', { name: 'Rename Orange kitten' }),
      'Ginger{Escape}'
    )

    expect(screen.queryByRole('textbox')).toBeNull()
    expect(kitten()).toHaveFocus()
  })

  it('keeps the scene description and a shuffleable seed under Advanced', async () => {
    screenIsWide(true)
    const user = await openExample()
    expect(
      within(panel()).queryByRole('spinbutton', { name: 'Seed' })
    ).toBeNull()

    await user.click(within(panel()).getByRole('button', { name: /^Advanced/ }))

    expect(
      within(panel()).getByRole('spinbutton', { name: 'Seed' })
    ).toHaveValue(42)
    expect(
      within(panel()).getByRole('textbox', {
        name: 'Describe the scene (optional)'
      })
    ).toHaveValue('')

    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    await user.click(within(panel()).getByRole('button', { name: 'New seed' }))
    expect(
      within(panel()).getByRole('spinbutton', { name: 'Seed' })
    ).toHaveValue(500_000_000)
    expect(
      within(panel()).getByRole('button', { name: /^Advanced/ })
    ).toHaveTextContent('Seed 500000000')
  })

  it('opens on phones as a sheet with a one-line summary and the run button', async () => {
    screenIsWide(false)
    const user = await openExample()
    const summary = within(panel()).getByRole('button', {
      name: '3 objects · 0 moved · Fast'
    })
    expect(within(panel()).getByTestId('move-generate')).toBeDisabled()
    expect(
      within(panel()).getByRole('toolbar', { name: 'Move anything tools' })
    ).toBeVisible()

    await user.click(summary)

    expect(
      within(panel()).getByRole('button', { name: 'Quality: Fast' })
    ).toBeVisible()
    expect(
      within(panel()).getByRole('button', { name: 'Hide settings' })
    ).toHaveAttribute('aria-expanded', 'true')
  })
})
