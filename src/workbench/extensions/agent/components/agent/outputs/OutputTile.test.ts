import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'vue-component-type-helpers'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { startAssetDrag } from '@/platform/assets/utils/assetDragUtil'

import OutputTile from './OutputTile.vue'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/platform/assets/utils/assetDragUtil'), () => ({
  startAssetDrag: vi.fn()
}))

const asset: AssetItem = {
  id: 'asset-1',
  name: 'ComfyUI_00001_.png',
  tags: ['output'],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  thumbnail_url: '/api/view?filename=ComfyUI_00001_.png&res=512',
  preview_url: '/api/view?filename=ComfyUI_00001_.png'
}

function renderTile(props: Partial<ComponentProps<typeof OutputTile>> = {}) {
  return render(OutputTile, {
    props: {
      asset,
      kind: 'image',
      name: 'sunset.png',
      selected: false,
      inMessage: false,
      ...props
    },
    global: { plugins: [i18n] }
  })
}

describe('OutputTile', () => {
  it('asks to be toggled when it is clicked', async () => {
    const { emitted } = renderTile()

    await userEvent.click(
      screen.getByRole('button', { name: 'Select sunset.png' })
    )

    expect(emitted('toggle')).toHaveLength(1)
  })

  it.for(['{Enter}', ' '])(
    'asks to be toggled from the keyboard with "%s"',
    async (key) => {
      const user = userEvent.setup()
      const { emitted } = renderTile()

      await user.tab()
      expect(
        screen.getByRole('button', { name: 'Select sunset.png' })
      ).toHaveFocus()
      await user.keyboard(key)

      expect(emitted('toggle')).toHaveLength(1)
    }
  )

  it.for([
    { selected: false, pressed: 'false' },
    { selected: true, pressed: 'true' }
  ])(
    'reports pressed as $pressed when selected is $selected',
    ({ selected, pressed }) => {
      renderTile({ selected })

      expect(
        screen.getByRole('button', { name: 'Select sunset.png' })
      ).toHaveAttribute('aria-pressed', pressed)
    }
  )

  it('asks for a preview without toggling', async () => {
    const { emitted } = renderTile()

    await userEvent.click(
      screen.getByRole('button', { name: 'Preview sunset.png' })
    )

    expect(emitted('preview')).toHaveLength(1)
    expect(emitted('toggle')).toBeUndefined()
  })

  it.for(['text', 'other'] as const)(
    'offers no preview for a file of kind %s',
    (kind) => {
      renderTile({ kind, name: 'notes.bin' })

      expect(
        screen.queryByRole('button', { name: 'Preview notes.bin' })
      ).not.toBeInTheDocument()
    }
  )

  it('shows the thumbnail of an image', () => {
    renderTile()

    expect(screen.getByRole('img', { name: 'sunset.png' })).toHaveAttribute(
      'src',
      '/api/view?filename=ComfyUI_00001_.png&res=512'
    )
  })

  it('falls back to the preview of an image that has no thumbnail', () => {
    renderTile({ asset: { ...asset, thumbnail_url: undefined } })

    expect(screen.getByRole('img', { name: 'sunset.png' })).toHaveAttribute(
      'src',
      '/api/view?filename=ComfyUI_00001_.png'
    )
  })

  it('plays a video on hover and pauses it on leave', async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue()
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => {})
    renderTile({
      asset: {
        ...asset,
        name: 'clip.mp4',
        preview_url: '/api/view?filename=clip.mp4'
      },
      kind: 'video',
      name: 'clip.mp4'
    })
    const video = screen.getByTestId('agent-output-tile-video')

    expect(video).toHaveAttribute('src', '/api/view?filename=clip.mp4')
    expect(video).toHaveAttribute('preload', 'metadata')

    await userEvent.hover(video)
    expect(play).toHaveBeenCalledTimes(1)

    await userEvent.unhover(video)
    expect(pause).toHaveBeenCalledTimes(1)
  })

  it.for(['audio', '3D', 'text', 'other'] as const)(
    'names a file of kind %s instead of drawing it',
    (kind) => {
      renderTile({ kind, name: 'take-one.bin' })

      expect(screen.getByText('take-one.bin')).toBeVisible()
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    }
  )

  it('shows no stack badge for a run with a single file', () => {
    renderTile({ stackCount: 1 })

    expect(
      screen.queryByRole('button', { name: /from this run/ })
    ).not.toBeInTheDocument()
  })

  it.for([
    { stackCount: 2, label: 'Show 1 more from this run' },
    { stackCount: 4, label: 'Show 3 more from this run' }
  ])(
    'offers the other files of a run of $stackCount',
    async ({ stackCount, label }) => {
      const { emitted } = renderTile({ stackCount })
      const badge = screen.getByRole('button', { name: label })

      expect(badge).toHaveTextContent(String(stackCount))
      expect(badge).toHaveAttribute('aria-expanded', 'false')

      await userEvent.click(badge)

      expect(emitted('toggleStack')).toHaveLength(1)
      expect(emitted('toggle')).toBeUndefined()
    }
  )

  it('offers to hide the other files of an expanded run', () => {
    renderTile({ stackCount: 4, stackExpanded: true })

    expect(
      screen.getByRole('button', { name: 'Hide the others from this run' })
    ).toHaveAttribute('aria-expanded', 'true')
  })

  it('marks the stack badge busy while the run is loading', () => {
    renderTile({ stackCount: 4, stackLoading: true })

    expect(
      screen.getByRole('button', { name: 'Show 3 more from this run' })
    ).toHaveAttribute('aria-busy', 'true')
  })

  it('starts an asset drag with its asset', async () => {
    renderTile()

    await fireEvent.dragStart(screen.getByTestId('agent-output-tile'))

    expect(startAssetDrag).toHaveBeenCalledExactlyOnceWith(
      expect.any(Event),
      asset
    )
  })

  it.for([
    { inMessage: true, count: 1 },
    { inMessage: false, count: 0 }
  ])(
    'shows the in-message badge $count time(s) when inMessage is $inMessage',
    ({ inMessage, count }) => {
      renderTile({ inMessage })

      expect(screen.queryAllByText('In your message')).toHaveLength(count)
    }
  )
})
