import userEvent from '@testing-library/user-event'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/vue'
import { assert, describe, expect, it, vi } from 'vitest'

import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'
import { i18n } from '@/i18n'

import AttachmentChip from './AttachmentChip.vue'

function renderChip(props: {
  name: string
  previewUrl?: string
  mediaUrl?: string
  mediaKind?: MediaKind
  uploading?: boolean
}) {
  return render(AttachmentChip, {
    props,
    global: { plugins: [i18n] }
  })
}

function iconMarker(container: Element): string {
  return container.querySelector(
    'span[class*="lucide--"], span[class*="icon-"]'
  )
    ? (container.querySelector('span[class*="lucide--"]')?.className ?? '')
    : ''
}

describe('AttachmentChip', () => {
  it.for([
    { name: 'cat.png', previewUrl: 'blob:cat' },
    { name: 'song.mp3', previewUrl: undefined }
  ])(
    'shows $name only on hover while retaining an accessible tray item',
    async (props) => {
      const user = userEvent.setup()
      renderChip(props)
      expect(screen.queryByText(props.name)).not.toBeInTheDocument()
      await user.hover(screen.getByRole('group', { name: props.name }))
      const preview = await screen.findByRole('tooltip', { name: props.name })
      expect(within(preview).getByText(props.name)).toBeVisible()
    }
  )

  it('renders an image preview only for image files', () => {
    renderChip({ name: 'cat.png', previewUrl: 'blob:x' })
    expect(screen.getByAltText('cat.png')).toBeInTheDocument()
  })

  // A server thumbnail for a non-image asset must not resurrect the broken
  // image chip e8d71a32fb removed.
  it('ignores a preview url on a non-image file', () => {
    const { container } = renderChip({
      name: 'song.mp3',
      previewUrl: 'https://x/thumb.png'
    })
    expect(screen.queryByAltText('song.mp3')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Audio' })).toBeInTheDocument()
    expect(iconMarker(container)).toContain('lucide--music')
  })

  it.for([
    ['clip.mp4', 'lucide--video'],
    ['voice.m4a', 'lucide--music'],
    ['mesh.glb', 'lucide--box'],
    ['notes.md', 'lucide--text'],
    ['data.bin', 'lucide--file']
  ])('shows the %s icon matched to its type', ([name, icon]) => {
    const { container } = renderChip({ name })
    expect(iconMarker(container)).toContain(icon)
  })

  it('shows a video poster while keeping the playable file separate', async () => {
    const user = userEvent.setup()
    renderChip({
      name: 'My clip',
      mediaKind: 'video',
      previewUrl: '/poster.png',
      mediaUrl: '/clip.mp4'
    })
    expect(screen.getByRole('img', { name: 'My clip' })).toHaveAttribute(
      'src',
      '/poster.png'
    )
    await user.hover(screen.getByRole('group', { name: 'My clip' }))
    const player = await screen.findByLabelText('My clip', {
      selector: 'video'
    })
    expect(player).toHaveAttribute('src', '/clip.mp4')
    expect(player).toHaveAttribute('poster', '/poster.png')
    expect(player).toHaveAttribute('controls')
    expect(player).not.toHaveAttribute('autoplay')
  })

  it('does not decode another video while waiting for the shared poster', () => {
    renderChip({ name: 'clip.mp4', mediaUrl: '/clip.mp4' })
    expect(
      screen.queryByLabelText('clip.mp4', { selector: 'video' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Video' })).toBeInTheDocument()
  })

  it.for([
    { name: 'clip.mp4', mediaKind: 'video', selector: 'video' },
    { name: 'song.mp3', mediaKind: 'audio', selector: 'audio' }
  ] as const)(
    'keeps $mediaKind controls usable inside hover preview and stops on close',
    async ({ name, mediaKind, selector }) => {
      const user = userEvent.setup()
      renderChip({
        name,
        mediaKind,
        mediaUrl: '/playable-media',
        previewUrl: '/poster.png'
      })
      const trigger = screen.getByRole('group', { name })
      await user.hover(trigger)
      const player = await screen.findByLabelText(name, { selector })
      assert.instanceOf(player, HTMLMediaElement)
      expect(player).toHaveAttribute('controls')
      expect(player).toHaveAttribute('src', '/playable-media')
      expect(player).not.toHaveAttribute('autoplay')
      await user.unhover(trigger)
      await user.hover(player)
      expect(screen.getByRole('region', { name })).toBeVisible()
      expect(player).toBeInTheDocument()
      await fireEvent.play(player)
      const pause = vi.spyOn(player, 'pause')
      await user.keyboard('{Escape}')
      await waitFor(() => expect(player).not.toBeInTheDocument())
      expect(pause).toHaveBeenCalledOnce()
    }
  )

  it('stops audio after the pointer leaves the preview', async () => {
    const user = userEvent.setup()
    renderChip({ name: 'song.mp3', mediaUrl: '/song.mp3' })
    const trigger = screen.getByRole('group', { name: 'song.mp3' })
    await user.hover(trigger)
    const player = await screen.findByLabelText('song.mp3', {
      selector: 'audio'
    })
    assert.instanceOf(player, HTMLAudioElement)
    const pause = vi.spyOn(player, 'pause')
    await user.unhover(trigger)
    await user.pointer({
      target: document.body,
      coords: { clientX: 500, clientY: 500 }
    })
    await waitFor(() => expect(player).not.toBeInTheDocument())
    expect(pause).toHaveBeenCalledOnce()
  })

  it('stops an audio preview on replacement and removal', async () => {
    const user = userEvent.setup()
    const { rerender, unmount } = renderChip({
      name: 'song.mp3',
      mediaUrl: 'blob:song'
    })
    await user.hover(screen.getByRole('group', { name: 'song.mp3' }))
    const first = await screen.findByLabelText('song.mp3', {
      selector: 'audio'
    })
    assert.instanceOf(first, HTMLAudioElement)
    const pauseFirst = vi.spyOn(first, 'pause')
    await rerender({ name: 'song.mp3', mediaUrl: '/stored-song.mp3' })
    const replacement = screen.getByLabelText('song.mp3', { selector: 'audio' })
    assert.instanceOf(replacement, HTMLAudioElement)
    expect(replacement).toHaveAttribute('src', '/stored-song.mp3')
    expect(pauseFirst).toHaveBeenCalledOnce()
    const pauseReplacement = vi.spyOn(replacement, 'pause')
    unmount()
    expect(pauseReplacement).toHaveBeenCalledOnce()
  })

  it.for([
    { name: 'clip.mp4', selector: 'video', message: 'Video failed to load' },
    { name: 'song.mp3', selector: 'audio', message: 'Audio failed to load' }
  ])(
    'reports an unplayable $name without losing the asset name',
    async ({ name, selector, message }) => {
      const user = userEvent.setup()
      renderChip({
        name,
        mediaUrl: '/unsupported-media',
        previewUrl: '/poster.png'
      })
      await user.hover(screen.getByRole('group', { name }))
      const player = await screen.findByLabelText(name, { selector })
      await fireEvent.error(player)
      expect(screen.getByText(message)).toBeVisible()
      expect(screen.getByText(name)).toBeVisible()
    }
  )

  it('shows the spinner while uploading', () => {
    renderChip({ name: 'cat.png', uploading: true })
    expect(
      screen.getByRole('status', { name: 'Uploading' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
