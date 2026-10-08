import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { nextTick } from 'vue'

import { i18n } from '@/i18n'

import type { ComposerAttachment } from '../../../types/composerAttachment'
import AssetTray from './AssetTray.vue'

const images: ComposerAttachment[] = [
  { id: 'cat', name: 'cat.png', ref: 'cat.png', previewUrl: '/cat.png' },
  { id: 'dog', name: 'dog.png', ref: 'dog.png', previewUrl: '/dog.png' }
]

function renderTray(attachments = images) {
  const view = render(AssetTray, {
    props: { attachments },
    global: { plugins: [i18n], directives: { tooltip: () => {} } }
  })
  onTestFinished(async () => {
    view.unmount()
    await nextTick()
  })
  return {
    ...view,
    user: userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync })
  }
}

describe('asset tray previews', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    return () => vi.useRealTimers()
  })

  it('replaces a clicked preview when another asset is hovered', async () => {
    const { user } = renderTray()
    const first = screen.getByRole('button', { name: 'Preview cat.png' })
    const second = screen.getByRole('button', { name: 'Preview dog.png' })
    await user.click(first)
    expect(screen.getByRole('dialog', { name: 'cat.png' })).toBeVisible()

    await user.hover(second)
    await vi.advanceTimersByTimeAsync(250)
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: 'dog.png' })).toBeVisible()
    expect(first).toHaveAttribute('aria-expanded', 'false')

    await user.unhover(second)
    await vi.advanceTimersByTimeAsync(150)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the newly clicked preview open after the previous hover settles', async () => {
    const { user } = renderTray()
    const first = screen.getByRole('button', { name: 'Preview cat.png' })
    const second = screen.getByRole('button', { name: 'Preview dog.png' })
    await user.hover(first)
    await vi.advanceTimersByTimeAsync(250)
    const preview = screen.getByRole('dialog', { name: 'cat.png' })
    expect(preview).toBeVisible()
    await user.hover(screen.getByRole('region', { name: 'cat.png' }))
    await vi.advanceTimersByTimeAsync(150)

    await user.click(second)
    await vi.advanceTimersByTimeAsync(250)
    await user.unhover(second)
    await vi.advanceTimersByTimeAsync(150)
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: 'dog.png' })).toBeVisible()
    expect(preview).not.toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(second).toHaveFocus()
    await user.hover(first)
    await vi.advanceTimersByTimeAsync(250)
    expect(screen.getByRole('dialog', { name: 'cat.png' })).toBeVisible()
  })

  it('switches keyboard activation and returns focus to the current trigger on Escape', async () => {
    const { user } = renderTray()
    const first = screen.getByRole('button', { name: 'Preview cat.png' })
    const second = screen.getByRole('button', { name: 'Preview dog.png' })
    first.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('dialog', { name: 'cat.png' })).toBeVisible()
    second.focus()
    await user.keyboard(' ')

    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: 'dog.png' })).toBeVisible()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(second).toHaveFocus()
  })

  it('switches previews on touch activation without depending on hover', async () => {
    const { user } = renderTray()
    const first = screen.getByRole('button', { name: 'Preview cat.png' })
    const second = screen.getByRole('button', { name: 'Preview dog.png' })
    await user.pointer([
      { keys: '[TouchA>]', target: first },
      { keys: '[/TouchA]', target: first }
    ])
    expect(screen.getByRole('dialog', { name: 'cat.png' })).toBeVisible()
    await user.pointer([
      { keys: '[TouchA>]', target: second },
      { keys: '[/TouchA]', target: second }
    ])
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: 'dog.png' })).toBeVisible()
  })

  it('does not reopen a removed active preview when the same attachment returns', async () => {
    const { user, rerender } = renderTray()
    await user.click(screen.getByRole('button', { name: 'Preview cat.png' }))
    expect(screen.getByRole('dialog', { name: 'cat.png' })).toBeVisible()
    await rerender({ attachments: [images[1]] })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await rerender({ attachments: images })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.hover(screen.getByRole('button', { name: 'Preview dog.png' }))
    await vi.advanceTimersByTimeAsync(250)
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: 'dog.png' })).toBeVisible()
  })

  it('keeps typing focus and text while switching hover previews', async () => {
    const { user } = renderTray()
    const promptView = render({ template: '<input aria-label="Prompt" />' })
    onTestFinished(promptView.unmount)
    const prompt = screen.getByRole('textbox', { name: 'Prompt' })
    await user.type(prompt, 'Keep typing')
    await user.hover(screen.getByRole('button', { name: 'Preview cat.png' }))
    await vi.advanceTimersByTimeAsync(250)
    expect(screen.getByRole('dialog', { name: 'cat.png' })).toBeVisible()
    await user.hover(screen.getByRole('button', { name: 'Preview dog.png' }))
    await vi.advanceTimersByTimeAsync(250)

    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: 'dog.png' })).toBeVisible()
    expect(prompt).toHaveFocus()
    await user.keyboard(' here')
    expect(prompt).toHaveValue('Keep typing here')
  })

  it.for([
    { name: 'song.mp3', mediaKind: 'audio', selector: 'audio' },
    { name: 'clip.mp4', mediaKind: 'video', selector: 'video' }
  ] as const)(
    'stops $mediaKind playback when a hovered asset replaces its interactive preview',
    async ({ name, mediaKind, selector }) => {
      const { user } = renderTray([
        { id: 'media', name, ref: name, mediaUrl: '/media', mediaKind },
        images[1]
      ])
      await user.click(screen.getByRole('button', { name: `Preview ${name}` }))
      const player = screen.getByLabelText(name, { selector })
      assert.instanceOf(player, HTMLMediaElement)
      player.currentTime = 1
      const pause = vi.spyOn(player, 'pause')

      await user.hover(screen.getByRole('button', { name: 'Preview dog.png' }))
      await vi.advanceTimersByTimeAsync(250)
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
      expect(screen.getByRole('dialog', { name: 'dog.png' })).toBeVisible()
      expect(player.currentTime).toBe(0)
      expect(pause).toHaveBeenCalled()
      expect(player).not.toBeInTheDocument()
    }
  )
})
