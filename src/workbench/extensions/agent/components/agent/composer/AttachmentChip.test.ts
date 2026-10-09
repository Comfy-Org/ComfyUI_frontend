import userEvent from '@testing-library/user-event'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/vue'
import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick } from 'vue'

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
  const rendered = render(AttachmentChip, {
    props,
    global: { plugins: [i18n] }
  })
  onTestFinished(async () => {
    rendered.unmount()
    await nextTick()
  })
  return rendered
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
    { name: 'cat.png', previewUrl: 'blob:cat', key: '{Enter}' },
    { name: 'notes.txt', previewUrl: undefined, key: ' ' }
  ])(
    'discloses $name from the keyboard and restores focus on Escape',
    async ({ key, ...props }) => {
      const user = userEvent.setup()
      renderChip(props)
      expect(screen.queryByText(props.name)).not.toBeInTheDocument()
      await user.tab()
      const trigger = screen.getByRole('button', {
        name: `Preview ${props.name}`
      })
      expect(trigger).toHaveFocus()
      await user.keyboard(key)
      const preview = await screen.findByRole('dialog', { name: props.name })
      expect(within(preview).getByText(props.name)).toBeVisible()
      await user.keyboard('{Escape}')
      await waitFor(() => expect(preview).not.toBeInTheDocument())
      expect(trigger).toHaveFocus()
    }
  )

  it('names the removal action and keeps it separate from preview activation', async () => {
    const user = userEvent.setup()
    const { emitted } = renderChip({ name: 'notes.txt' })
    await user.click(screen.getByRole('button', { name: 'Remove notes.txt' }))
    expect(emitted().remove).toHaveLength(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it.for([
    { name: 'clip.mp4', selector: 'video', key: '{Enter}' },
    { name: 'song.mp3', selector: 'audio', key: ' ' }
  ])(
    'closes $name playback on Escape even when a global handler prevents the default',
    async ({ name, selector, key }) => {
      const user = userEvent.setup()
      renderChip({ name, mediaUrl: '/playable-media' })
      const preventEscapeDefault = (event: KeyboardEvent) => {
        if (event.key === 'Escape') event.preventDefault()
      }
      window.addEventListener('keydown', preventEscapeDefault, {
        capture: true
      })
      onTestFinished(() => {
        window.removeEventListener('keydown', preventEscapeDefault, {
          capture: true
        })
      })
      const trigger = screen.getByRole('button', { name: `Preview ${name}` })
      await user.tab()
      expect(trigger).toHaveFocus()
      await user.keyboard(key)
      expect(await screen.findByRole('dialog', { name })).toBeVisible()
      await waitFor(() =>
        expect(trigger).toHaveAttribute('aria-expanded', 'true')
      )
      const player = screen.getByLabelText(name, { selector })
      assert.instanceOf(player, HTMLMediaElement)
      await waitFor(() => expect(player).toHaveFocus())
      expect(player).toHaveAttribute('controls')
      expect(player).not.toHaveAttribute('tabindex', '-1')
      player.currentTime = 1
      const pause = vi.spyOn(player, 'pause')
      await user.keyboard('{Escape}')
      await waitFor(() => expect(player).not.toBeInTheDocument())
      await waitFor(() => expect(trigger).toHaveFocus())
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
      expect(pause).toHaveBeenCalledTimes(2)
      expect(player.currentTime).toBe(0)
      await user.keyboard(key)
      expect(await screen.findByLabelText(name, { selector })).toHaveAttribute(
        'src',
        '/playable-media'
      )
    }
  )

  it('keeps removal independent of opening media playback', async () => {
    const user = userEvent.setup()
    const { emitted } = renderChip({ name: 'clip.mp4', mediaUrl: '/clip.mp4' })
    await user.click(screen.getByRole('button', { name: 'Remove clip.mp4' }))
    expect(emitted().remove).toHaveLength(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('promotes a hovered preview to keyboard playback and keeps it open after the pointer leaves', async () => {
    const user = userEvent.setup()
    renderChip({ name: 'clip.mp4', mediaUrl: '/clip.mp4' })
    const trigger = screen.getByRole('button', { name: 'Preview clip.mp4' })
    await user.tab()
    expect(trigger).toHaveFocus()
    await user.hover(trigger)
    const player = await screen.findByLabelText('clip.mp4', {
      selector: 'video'
    })
    expect(trigger).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(player).toHaveFocus()
    await user.unhover(trigger)
    await user.pointer({ target: document.body })
    expect(screen.getByRole('dialog', { name: 'clip.mp4' })).toBeVisible()
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(trigger).toHaveFocus()
  })

  it('preserves typing focus when a hover preview opens and closes', async () => {
    const user = userEvent.setup()
    renderChip({ name: 'clip.mp4', mediaUrl: '/clip.mp4' })
    const promptView = render({ template: '<input aria-label="Prompt" />' })
    onTestFinished(promptView.unmount)
    const prompt = screen.getByRole('textbox', { name: 'Prompt' })
    await user.click(prompt)
    await user.type(prompt, 'Keep typing')
    const trigger = screen.getByRole('button', { name: 'Preview clip.mp4' })
    await user.hover(trigger)
    const player = await screen.findByLabelText('clip.mp4', {
      selector: 'video'
    })
    expect(prompt).toHaveFocus()
    await user.unhover(trigger)
    await user.pointer({ target: document.body })
    await waitFor(() => expect(player).not.toBeInTheDocument())
    expect(prompt).toHaveFocus()
    expect(prompt).toHaveValue('Keep typing')
  })

  it('keeps keyboard playback focused when its source is replaced and clears an earlier load error', async () => {
    const user = userEvent.setup()
    const { rerender } = renderChip({ name: 'clip.mp4', mediaUrl: 'blob:clip' })
    const trigger = screen.getByRole('button', { name: 'Preview clip.mp4' })
    await user.tab()
    await user.keyboard('{Enter}')
    const player = await screen.findByLabelText('clip.mp4', {
      selector: 'video'
    })
    assert.instanceOf(player, HTMLVideoElement)
    await waitFor(() => expect(player).toHaveFocus())
    await fireEvent.error(player)
    expect(screen.getByText('Video failed to load')).toBeVisible()
    const pause = vi.spyOn(player, 'pause')
    await rerender({ mediaUrl: '/uploaded.mp4' })
    expect(
      screen.getByLabelText('clip.mp4', { selector: 'video' })
    ).toHaveFocus()
    expect(
      screen.getByLabelText('clip.mp4', { selector: 'video' })
    ).toHaveAttribute('src', '/uploaded.mp4')
    expect(screen.queryByText('Video failed to load')).not.toBeInTheDocument()
    expect(pause).toHaveBeenCalledOnce()
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(trigger).toHaveFocus()
  })

  it.for([
    { name: 'cat.png', previewUrl: 'blob:cat' },
    { name: 'song.mp3', previewUrl: undefined }
  ])(
    'shows $name only on hover while retaining an accessible tray item',
    async (props) => {
      const user = userEvent.setup()
      renderChip(props)
      expect(screen.queryByText(props.name)).not.toBeInTheDocument()
      await user.hover(
        screen.getByRole('button', { name: `Preview ${props.name}` })
      )
      const preview = await screen.findByRole('dialog', { name: props.name })
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
    await user.hover(screen.getByRole('button', { name: 'Preview My clip' }))
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
      const trigger = screen.getByRole('button', { name: `Preview ${name}` })
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
      player.currentTime = 1
      const pause = vi.spyOn(player, 'pause')
      await user.keyboard('{Escape}')
      await waitFor(() => expect(player).not.toBeInTheDocument())
      expect(pause).toHaveBeenCalledTimes(2)
      expect(player.currentTime).toBe(0)
    }
  )

  it('keeps hover usable after keyboard and hovered-content dismissals', async () => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync })
    renderChip({ name: 'clip.mp4', mediaUrl: '/clip.mp4' })
    const trigger = screen.getByRole('button', { name: 'Preview clip.mp4' })
    await user.tab()
    await user.keyboard('{Enter}')
    expect(
      screen.getByLabelText('clip.mp4', { selector: 'video' })
    ).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.hover(trigger)
    await vi.advanceTimersByTimeAsync(250)
    const first = screen.getByLabelText('clip.mp4', { selector: 'video' })
    await user.hover(first)
    await vi.advanceTimersByTimeAsync(150)
    await user.keyboard('{Escape}')
    await vi.advanceTimersByTimeAsync(150)
    expect(first).not.toBeInTheDocument()
    await user.hover(trigger)
    await vi.advanceTimersByTimeAsync(250)
    const second = screen.getByLabelText('clip.mp4', { selector: 'video' })
    await user.unhover(trigger)
    await user.pointer({ target: document.body })
    await vi.advanceTimersByTimeAsync(150)
    expect(second).not.toBeInTheDocument()
    // Escape also cancels a pointer hover whose delayed opening is still pending.
    await user.hover(trigger)
    await user.keyboard('{Enter}')
    await user.keyboard('{Escape}')
    await vi.advanceTimersByTimeAsync(250)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.unhover(trigger)
    await vi.advanceTimersByTimeAsync(150)
    await user.hover(trigger)
    await vi.advanceTimersByTimeAsync(250)
    expect(screen.getByRole('dialog', { name: 'clip.mp4' })).toBeVisible()
  })

  it('stops audio after the pointer leaves the preview', async () => {
    const user = userEvent.setup()
    renderChip({ name: 'song.mp3', mediaUrl: '/song.mp3' })
    const trigger = screen.getByRole('button', { name: 'Preview song.mp3' })
    await user.hover(trigger)
    const player = await screen.findByLabelText('song.mp3', {
      selector: 'audio'
    })
    assert.instanceOf(player, HTMLAudioElement)
    player.currentTime = 1
    const pause = vi.spyOn(player, 'pause')
    await user.unhover(trigger)
    await user.pointer({
      target: document.body,
      coords: { clientX: 500, clientY: 500 }
    })
    await waitFor(() => expect(player).not.toBeInTheDocument())
    expect(pause).toHaveBeenCalledTimes(2)
    expect(player.currentTime).toBe(0)
  })

  it('stops an audio preview on replacement and removal', async () => {
    const user = userEvent.setup()
    const { rerender, unmount } = renderChip({
      name: 'song.mp3',
      mediaUrl: 'blob:song'
    })
    await user.hover(screen.getByRole('button', { name: 'Preview song.mp3' }))
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
    unmount()
    expect(pauseFirst).toHaveBeenCalledTimes(2)
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
      await user.hover(screen.getByRole('button', { name: `Preview ${name}` }))
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
