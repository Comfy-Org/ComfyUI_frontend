import { fireEvent, render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { DarkroomJob, DarkroomSlot } from '@/lib/darkroom/feed'
import { jobsFromStore } from '@/lib/darkroom/feed'
import type { DarkroomRequest } from '@/lib/darkroom/request'
import type { DarkroomBoard, DarkroomItem } from '@/lib/darkroom/store'

import DarkroomBoardMenu from './DarkroomBoardMenu.vue'
import DarkroomLightbox from './DarkroomLightbox.vue'
import DarkroomMoodboards from './DarkroomMoodboards.vue'
import DarkroomOrganize from './DarkroomOrganize.vue'
import DarkroomTile from './DarkroomTile.vue'

vi.mock(import('@/lib/darkroom/shader'), () => ({
  startLoadingTile: vi.fn(),
  stopLoadingTile: vi.fn()
}))

const settings: DarkroomRequest = {
  prompt: 'A fox reading a map',
  model: 'vertexai/gemini-nano-banana-2.1',
  aspectRatio: '16:9',
  imageSize: '2K',
  mimeType: 'image/png',
  temperature: 1,
  seed: 100,
  jobId: 'job',
  run: 0,
  runs: 3,
  inputCount: 0
}

function item(id: string, run: number, rest: Partial<DarkroomItem> = {}) {
  return {
    id,
    created: 1_000,
    mime: 'image/png',
    settings: { ...settings, run, seed: 100 + run },
    stats: { finishReasons: ['STOP'], totalTokens: 1200, seconds: 5.9 },
    text: [],
    ...rest
  } satisfies DarkroomItem
}

const items = [item('a', 0), item('b', 1, { starred: true }), item('c', 2)]
const jobs: DarkroomJob[] = jobsFromStore(items, [])
const urls = new Map(items.map((saved) => [saved.id, `blob:${saved.id}`]))

describe('DarkroomTile', () => {
  const tile = (slot: DarkroomSlot, retryable = false) =>
    render(DarkroomTile, {
      props: { tile: slot, shape: '16:9', url: 'blob:a', retryable }
    })

  it('says where a developing image stands and lets it be cancelled', async () => {
    const { emitted } = tile({
      key: 'job:0',
      run: 0,
      seed: 100,
      status: 'pending',
      phase: 'queued',
      ahead: 2,
      startedAt: Date.now()
    })

    expect(screen.getByText('In line · 2 ahead')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(emitted().cancel).toHaveLength(1)
    expect(emitted().open).toBeUndefined()
  })

  it('opens a finished image, and keeps its actions from opening it', async () => {
    const { emitted } = tile(jobs[0].slots[0])

    await userEvent.click(screen.getByRole('button', { name: 'Variations' }))
    await userEvent.click(screen.getByRole('button', { name: 'Star' }))
    expect(emitted().open).toBeUndefined()
    expect(emitted().vary).toHaveLength(1)
    expect(emitted().star).toHaveLength(1)

    await userEvent.click(screen.getByAltText('A fox reading a map'))
    expect(emitted().open).toHaveLength(1)
  })

  it('learns a tall image from its real size once it loads', async () => {
    const { emitted } = tile(jobs[0].slots[0])
    const image = screen.getByAltText('A fox reading a map')
    Object.defineProperties(image, {
      naturalWidth: { value: 900 },
      naturalHeight: { value: 1600 }
    })

    await fireEvent.load(image)

    expect(emitted().tall).toEqual([[true]])
  })

  it('explains a failure and offers another try when it can', async () => {
    const failed: DarkroomSlot = {
      key: 'job:0',
      run: 0,
      seed: 100,
      status: 'error',
      failure: 'rateLimit',
      detail: 'HTTP 429'
    }
    const { emitted, unmount } = tile(failed, true)

    expect(screen.getByText('Too many requests')).toBeTruthy()
    expect(screen.getByText('HTTP 429')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(emitted().retry).toHaveLength(1)

    unmount()
    tile({ ...failed, failure: 'cancelledInLine', cancelled: true })
    expect(screen.getByText('Cancelled')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })
})

describe('DarkroomLightbox', () => {
  const viewer = (viewed: DarkroomItem, hasNext = true) =>
    render(DarkroomLightbox, {
      props: { item: viewed, url: 'blob:a', hasPrevious: false, hasNext }
    })

  it('shows what made the image', () => {
    viewer(items[0])
    const dialog = screen.getByRole('dialog', { name: 'Image viewer' })

    expect(within(dialog).getByText('Nano Banana 2.1')).toBeTruthy()
    expect(within(dialog).getByText('Wide 16:9')).toBeTruthy()
    expect(within(dialog).getByText('Seed 100')).toBeTruthy()
    expect(within(dialog).getByText('5.9s')).toBeTruthy()
    expect(
      within(dialog)
        .getByRole('link', { name: 'Download' })
        .getAttribute('download')
    ).toBe('a-fox-reading-a-map_s100.png')
  })

  it('steps and closes from the keyboard, only where there is somewhere to go', async () => {
    const { emitted } = viewer(items[0])

    await userEvent.keyboard('{ArrowLeft}{ArrowRight}{Escape}')

    expect(emitted().step).toEqual([[1]])
    expect(emitted().close).toHaveLength(1)
  })

  it('marks a starred image and says when it is in Comfy Cloud', () => {
    viewer({ ...items[1], cloudAssetId: 'asset-1' })

    expect(
      screen
        .getByRole('button', { name: '★ Starred' })
        .getAttribute('aria-pressed')
    ).toBe('true')
    expect(screen.getByText('Saved to Comfy Cloud')).toBeTruthy()
  })
})

describe('DarkroomOrganize', () => {
  const organize = () => render(DarkroomOrganize, { props: { jobs, urls } })

  it('filters by prompt and by star', async () => {
    organize()
    const grid = screen.getByTestId('darkroom-organize-grid')
    expect(within(grid).getAllByRole('checkbox')).toHaveLength(3)

    await userEvent.click(screen.getByRole('button', { name: 'Starred' }))
    expect(within(grid).getAllByRole('checkbox')).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Starred' }))
    await userEvent.type(screen.getByLabelText('Search prompts'), 'lighthouse')
    expect(within(grid).queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('selects a range with Shift and acts on the selection', async () => {
    const { emitted } = organize()
    const tiles = screen.getAllByRole('checkbox')

    const user = userEvent.setup()
    await user.click(tiles[0])
    await user.keyboard('{Shift>}')
    await user.click(tiles[2])
    await user.keyboard('{/Shift}')
    const bar = screen.getByTestId('darkroom-selection-bar')
    expect(within(bar).getByText('3 selected')).toBeTruthy()

    await userEvent.click(within(bar).getByRole('button', { name: 'Star' }))
    expect(emitted().star).toEqual([[['a', 'b', 'c'], true]])

    await userEvent.click(within(bar).getByRole('button', { name: 'Delete' }))
    expect(emitted().remove).toEqual([[['a', 'b', 'c']]])
    expect(screen.queryByTestId('darkroom-selection-bar')).toBeNull()
  })

  it('selects everything shown, then clears it', async () => {
    organize()

    await userEvent.click(screen.getByRole('button', { name: 'Select all' }))
    expect(screen.getByText('3 selected')).toBeTruthy()

    await userEvent.click(
      screen.getByRole('button', { name: 'Clear selection' })
    )
    expect(screen.queryByTestId('darkroom-selection-bar')).toBeNull()
  })

  it('opens an image larger without selecting it', async () => {
    const { emitted } = organize()

    await userEvent.click(
      screen.getAllByRole('button', { name: 'View larger' })[0]
    )

    expect(emitted().open).toEqual([[items[0]]])
    expect(screen.queryByTestId('darkroom-selection-bar')).toBeNull()
  })

  it('says so when nothing has been made yet', () => {
    render(DarkroomOrganize, { props: { jobs: [], urls } })
    expect(screen.getByText('Nothing here yet')).toBeTruthy()
  })
})

describe('moodboards', () => {
  const boards: DarkroomBoard[] = [
    { id: 'dusk', name: 'Dusk', created: 1, updated: 1, items: ['a', 'b'] },
    { id: 'empty', name: 'Empty', created: 2, updated: 2, items: [] }
  ]
  const itemsOf = (board: DarkroomBoard) => [...board.items]
  const moodboards = (openId?: string, activeId?: string) =>
    render(DarkroomMoodboards, {
      props: { boards, openId, activeId, urls, itemsOf }
    })

  it('lists the boards and marks the one in use', async () => {
    const { emitted } = moodboards(undefined, 'dusk')
    const [dusk] = screen.getAllByTestId('darkroom-board-card')

    expect(within(dusk).getByText('In use')).toBeTruthy()
    expect(within(dusk).getByText('2 images')).toBeTruthy()

    await userEvent.click(dusk)
    await userEvent.click(screen.getByRole('button', { name: 'New moodboard' }))
    expect(emitted().show).toEqual([['dusk']])
    expect(emitted().create).toHaveLength(1)
  })

  it('uses, renames and empties an open board', async () => {
    const { emitted } = moodboards('dusk')

    await userEvent.click(
      screen.getByRole('button', { name: 'Generate with this' })
    )
    const name = screen.getByLabelText('Moodboard name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Night')
    await userEvent.tab()
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Remove from moodboard' })[0]
    )

    expect(emitted().use).toEqual([['dusk']])
    expect(emitted().rename).toEqual([['dusk', 'Night']])
    expect(emitted().drop).toEqual([['dusk', 'a']])
  })

  it('stops following the board that is in use', async () => {
    const { emitted } = moodboards('dusk', 'dusk')

    await userEvent.click(screen.getByRole('button', { name: 'Stop using' }))

    expect(emitted().use).toEqual([[undefined]])
  })

  it('cannot generate with an empty board, and asks before deleting it', async () => {
    const confirm = vi.fn(() => false)
    vi.stubGlobal('confirm', confirm)
    const { emitted } = moodboards('empty')

    expect(
      screen
        .getByRole('button', { name: 'Generate with this' })
        .hasAttribute('disabled')
    ).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(emitted().remove).toBeUndefined()

    confirm.mockReturnValue(true)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(emitted().remove).toEqual([['empty']])
  })

  describe('DarkroomBoardMenu', () => {
    const menu = (mode: 'add' | 'use', activeId?: string) =>
      render(DarkroomBoardMenu, {
        props: {
          anchor: document.body,
          mode,
          boards,
          covers: new Map([['dusk', 'blob:a']]),
          activeId
        }
      })

    it('offers only boards with images to generate from', async () => {
      const { emitted } = menu('use', 'dusk')

      expect(screen.queryByRole('menuitem', { name: /Empty/ })).toBeNull()
      await userEvent.click(screen.getByRole('menuitem', { name: /Dusk/ }))
      await userEvent.click(
        screen.getByRole('menuitem', { name: 'No moodboard' })
      )
      await userEvent.click(
        screen.getByRole('menuitem', { name: 'Manage moodboards' })
      )

      expect(emitted().pick).toEqual([['dusk'], [undefined]])
      expect(emitted().manage).toHaveLength(1)
    })

    it('adds to any board, or starts a new one by name', async () => {
      const { emitted } = menu('add')

      await userEvent.click(screen.getByRole('menuitem', { name: /Empty/ }))
      await userEvent.type(
        screen.getByLabelText('New moodboard name'),
        'Night{Enter}'
      )

      expect(emitted().pick).toEqual([['empty'], [undefined, 'Night']])
    })

    it('closes on Escape', async () => {
      const { emitted } = menu('add')
      await userEvent.keyboard('{Escape}')
      expect(emitted().close).toHaveLength(1)
    })
  })
})
