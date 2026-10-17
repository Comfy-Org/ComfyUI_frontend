import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { Ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ConcatClip } from '@/composables/videoConcat/useVideoConcatClips'
import { toLinkId } from '@/types/linkId'

import {
  clipTiles as tiles,
  placeClipTiles as placeTiles,
  pressClipTile as press
} from './__fixtures__/clipTiles'
import VideoConcatPanel from './VideoConcatPanel.vue'

interface FakeFilmstrip {
  thumbnail: Ref<string>
  duration: Ref<number>
  width: Ref<number>
  height: Ref<number>
  loading: Ref<boolean>
}

const filmstrips = vi.hoisted(() => new Map<string, FakeFilmstrip>())

vi.mock<unknown>(import('@/composables/video/useVideoFilmstrip'), async () => {
  const { ref: createRef, toValue } = await import('vue')
  return {
    useVideoFilmstrip: (url: Ref<string | undefined>) => {
      const filmstrip = {
        thumbnail: createRef(''),
        duration: createRef(0),
        width: createRef(0),
        height: createRef(0),
        loading: createRef(true)
      }
      filmstrips.set(toValue(url) ?? '', filmstrip)
      return filmstrip
    }
  }
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      videoEdit: {
        duration: 'Duration',
        dimensions: 'Dimensions',
        resolution: '{width} x {height}',
        timecode: '{current} / {total}',
        play: 'Play',
        pause: 'Pause',
        mute: 'Mute',
        unmute: 'Unmute',
        seekVideo: 'Seek video',
        durationZero: '0s',
        durationSeconds: '{count}s'
      },
      videoConcat: {
        noClips: 'Connect videos to preview and order them',
        clips: 'Clips',
        clipLabel: 'Clip {position}',
        previewClips: 'Clips',
        previewResult: 'Last run',
        reorderHint: 'Drag clips to reorder, click to jump',
        mixedDimensions: 'Mixed sizes'
      }
    }
  }
})

function clip(name: string, linkId: number): ConcatClip {
  return { name, linkId: toLinkId(linkId), url: `/api/view?filename=${name}` }
}

const clips = [clip('video0', 1), clip('video1', 2), clip('video2', 3)]

function renderPanel(panelClips: ConcatClip[] = clips, resultUrl?: string) {
  return render(VideoConcatPanel, {
    props: { clips: panelClips, resultUrl },
    global: { plugins: [i18n] }
  })
}

function loadMetadata(
  video: Element,
  { duration, width = 320, height = 180 }: Record<string, number>
) {
  Object.defineProperties(video, {
    duration: { configurable: true, value: duration },
    videoWidth: { configurable: true, value: width },
    videoHeight: { configurable: true, value: height }
  })
  return fireEvent(video, new Event('loadedmetadata'))
}

async function loadTileMetadata(durations: number[], widths?: number[]) {
  for (const [index, clip] of clips.entries()) {
    const filmstrip = filmstrips.get(clip.url!)!
    filmstrip.thumbnail.value = `data:image/jpeg;base64,${clip.name}`
    filmstrip.duration.value = durations[index]
    filmstrip.width.value = widths?.[index] ?? 320
    filmstrip.height.value = 180
    filmstrip.loading.value = false
  }
  await nextTick()
}

function previewSource() {
  return screen.getByTestId('video-concat-preview').getAttribute('src')
}

describe('VideoConcatPanel', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  })

  it('shows an empty state without connected clips', () => {
    renderPanel([])

    expect(screen.getByTestId('video-concat-empty')).toBeTruthy()
    expect(screen.queryByTestId('video-concat-strip')).toBeNull()
  })

  it('shows each clip as its captured thumbnail', async () => {
    renderPanel()

    await loadTileMetadata([2, 3, 1.5])

    expect(
      screen
        .getAllByTestId('video-concat-clip-thumbnail')
        .map((image) => image.getAttribute('src'))
    ).toEqual([
      'data:image/jpeg;base64,video0',
      'data:image/jpeg;base64,video1',
      'data:image/jpeg;base64,video2'
    ])
    expect(tiles()[1].textContent).toContain('0:03')
  })

  it('numbers the clips in order and previews the first one', () => {
    renderPanel()

    expect(tiles().map((tile) => tile.dataset.clipName)).toEqual([
      'video0',
      'video1',
      'video2'
    ])
    expect(tiles().map((tile) => tile.textContent.trim())).toEqual([
      '1',
      '2',
      '3'
    ])
    expect(previewSource()).toBe('/api/view?filename=video0')
  })

  it('totals the clip durations once their metadata loads', async () => {
    renderPanel()

    await loadTileMetadata([2, 3, 1.5])

    expect(screen.getByText('6.5s')).toBeTruthy()
    expect(screen.getByText('320 x 180')).toBeTruthy()
    expect(screen.getByTestId('video-concat-timecode').textContent).toBe(
      '0:00 / 0:07'
    )
  })

  it('warns when the clips have different sizes', async () => {
    renderPanel()

    await loadTileMetadata([2, 3, 1.5], [320, 400, 320])

    expect(screen.getByText('Mixed sizes')).toBeTruthy()
  })

  it('emits a reorder when a tile is dragged past its neighbours', async () => {
    const { emitted } = renderPanel()
    placeTiles()

    await press(tiles()[0], 48)
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 260 }))
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 260 }))

    expect(emitted('reorder')).toEqual([[0, 2]])
  })

  it('previews the drop position while dragging', async () => {
    renderPanel()
    await loadTileMetadata([2, 3, 1.5])
    placeTiles()

    await press(tiles()[2], 248)
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 20 }))
    await nextTick()

    expect(tiles().map((tile) => tile.dataset.clipName)).toEqual([
      'video2',
      'video0',
      'video1'
    ])
    expect(screen.getByTestId('video-concat-drag-ghost').textContent).toBe('1')
    expect(
      screen
        .getByTestId('video-concat-drag-ghost-thumbnail')
        .getAttribute('src')
    ).toBe('data:image/jpeg;base64,video2')
    window.dispatchEvent(new PointerEvent('pointercancel'))
    await nextTick()
    expect(screen.queryByTestId('video-concat-drag-ghost')).toBeNull()
  })

  it('jumps to a clip when its tile is clicked without dragging', async () => {
    const { emitted } = renderPanel()
    await loadTileMetadata([2, 3, 1.5])

    await press(tiles()[2], 10)
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 11 }))
    await nextTick()

    expect(emitted('reorder')).toBeUndefined()
    expect(previewSource()).toBe('/api/view?filename=video2')
    expect(tiles()[2].getAttribute('aria-current')).toBe('true')
  })

  it('plays the next clip when the current one ends', async () => {
    renderPanel()
    await loadTileMetadata([2, 3, 1.5])

    await userEvent.click(screen.getByTestId('video-concat-playback-toggle'))
    await fireEvent(
      screen.getByTestId('video-concat-preview'),
      new Event('ended')
    )

    expect(previewSource()).toBe('/api/view?filename=video1')
    await loadMetadata(screen.getByTestId('video-concat-preview'), {
      duration: 3
    })
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2)
  })
  it('jumps to a clip with Enter', async () => {
    const { emitted } = renderPanel()
    await loadTileMetadata([2, 3, 1.5])

    screen.getByRole('listitem', { name: 'Clip 3' }).focus()
    await userEvent.keyboard('{Enter}')

    expect(emitted('reorder')).toBeUndefined()
    expect(previewSource()).toBe('/api/view?filename=video2')
  })

  it('moves a clip with Alt and the arrow keys', async () => {
    const { emitted } = renderPanel()

    screen.getByRole('listitem', { name: 'Clip 2' }).focus()
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}')
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}')

    expect(emitted('reorder')).toEqual([
      [1, 2],
      [1, 0]
    ])
  })

  it('ignores arrow keys that would move a clip past either end', async () => {
    const { emitted } = renderPanel()

    screen.getByRole('listitem', { name: 'Clip 1' }).focus()
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}{ArrowRight}')

    expect(emitted('reorder')).toBeUndefined()
  })
  it('offers the last run only once there is one', () => {
    renderPanel()

    expect(screen.queryByTestId('video-concat-preview-mode')).toBeNull()
  })

  it('plays the last run result and returns to the clips when a tile is picked', async () => {
    renderPanel(clips, '/api/view?filename=result')
    await loadTileMetadata([2, 3, 1.5])

    await userEvent.click(screen.getByRole('button', { name: 'Last run' }))

    expect(previewSource()).toBe('/api/view?filename=result')
    expect(tiles().filter((tile) => tile.getAttribute('aria-current'))).toEqual(
      []
    )

    await press(tiles()[2], 10)
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 11 }))
    await nextTick()
    await nextTick()

    expect(previewSource()).toBe('/api/view?filename=video2')
    expect(
      screen.getByRole('button', { name: 'Clips' }).getAttribute('aria-pressed')
    ).toBe('true')
  })
  it('moves on to the next clip when the playing clip fails to load', async () => {
    renderPanel()
    await loadTileMetadata([2, 3, 1.5])
    await userEvent.click(screen.getByTestId('video-concat-playback-toggle'))

    await fireEvent(
      screen.getByTestId('video-concat-preview'),
      new Event('error')
    )

    expect(previewSource()).toBe('/api/view?filename=video1')
  })

  it('stays on a clip that fails to load while stopped', async () => {
    renderPanel()
    await loadTileMetadata([2, 3, 1.5])

    await fireEvent(
      screen.getByTestId('video-concat-preview'),
      new Event('error')
    )

    expect(previewSource()).toBe('/api/view?filename=video0')
  })
})
