// @vitest-environment jsdom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

// jsdom lacks ResizeObserver, which the asset-preview import chain references.
vi.hoisted(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
})

import { i18n } from '@/i18n'

import UserMessage from './UserMessage.vue'

const clipboard = vi.hoisted(() => ({ copy: vi.fn() }))

vi.mock('@vueuse/core', async (importOriginal) => {
  const { ref } = await import('vue')
  return {
    ...(await importOriginal<object>()),
    useClipboard: () => ({
      copy: clipboard.copy,
      copied: ref(false),
      isSupported: ref(true),
      text: ref('')
    })
  }
})

const t = i18n.global.t

function renderMessage(props: {
  text: string
  attachments?: { name: string; previewUrl?: string; ref?: string }[]
  tags?: string[]
  editable?: boolean
}) {
  return render(UserMessage, {
    props,
    global: {
      plugins: [i18n],
      stubs: {
        ReplyAssetGroup: {
          props: ['assets'],
          template:
            '<div data-testid="reply-asset-group" :data-assets="JSON.stringify(assets)" />'
        }
      }
    }
  })
}

function stubbedAssets(): { url: string; filename: string; kind: string }[] {
  return JSON.parse(
    screen.getByTestId('reply-asset-group').dataset.assets ?? '[]'
  )
}

describe('UserMessage', () => {
  it('renders a caption-only placeholder tile for a preview-less attachment', () => {
    renderMessage({ text: '', attachments: [{ name: 'clip.bin' }] })

    expect(screen.getByText('clip.bin')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  // Uy's FE-1323 call: sent uploads reuse the reply asset grid, so media
  // attachments route through ReplyAssetGroup with the same DES-530 behavior.
  it('routes media attachments into the reply asset grid', () => {
    renderMessage({
      text: 'use these',
      attachments: [
        { name: 'a.png', previewUrl: 'blob:a' },
        { name: 'clip.mp4', ref: 'upload_clip.mp4' }
      ]
    })

    expect(stubbedAssets()).toEqual([
      { url: 'blob:a', filename: 'a.png', kind: 'image' },
      {
        url: expect.stringContaining(
          '/view?filename=upload_clip.mp4&type=input'
        ),
        filename: 'clip.mp4',
        kind: 'video'
      }
    ])
    expect(screen.getByText('use these')).toBeInTheDocument()
  })

  it('keeps non-media attachments as compact tiles beside the grid', () => {
    renderMessage({
      text: '',
      attachments: [
        { name: 'song.mp3', ref: 'upload_song.mp3' },
        { name: 'notes.md', ref: 'upload_notes.md' }
      ]
    })

    expect(stubbedAssets()).toEqual([
      {
        url: expect.stringContaining(
          '/view?filename=upload_song.mp3&type=input'
        ),
        filename: 'song.mp3',
        kind: 'audio'
      }
    ])
    expect(screen.getByText('notes.md')).toBeInTheDocument()
  })

  it('T-23 / PM-657 / FE-1297 reveals copy on hover and copies the exact prior prompt', async () => {
    const user = userEvent.setup()
    renderMessage({ text: 'make it cinematic' })

    await user.hover(screen.getByText('make it cinematic'))
    const copyButton = screen.getByRole('button', { name: t('agent.copy') })
    await user.hover(copyButton)
    expect(
      await screen.findByRole('tooltip', { hidden: true })
    ).toHaveTextContent(t('agent.copy'))
    await user.click(copyButton)

    expect(clipboard.copy).toHaveBeenCalledWith('make it cinematic')
  })

  it('reaches and triggers the copy action by keyboard alone', async () => {
    const user = userEvent.setup()
    renderMessage({ text: 'make it cinematic' })

    await user.tab()
    expect(screen.getByRole('button', { name: t('agent.copy') })).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(clipboard.copy).toHaveBeenCalledWith('make it cinematic')
  })

  it('offers an accessible edit action only when the prompt is editable', async () => {
    const user = userEvent.setup()
    const prompt = 'make it cinematic'
    const { emitted } = renderMessage({ text: prompt, editable: true })

    const editButton = screen.getByRole('button', { name: t('g.edit') })
    await user.hover(editButton)
    expect(
      await screen.findByRole('tooltip', { hidden: true })
    ).toHaveTextContent(t('g.edit'))
    await user.click(editButton)

    expect(emitted().edit).toEqual([[prompt]])
  })

  it('does not offer edit for a settled prompt without edit eligibility', () => {
    renderMessage({ text: 'make it cinematic' })

    expect(
      screen.queryByRole('button', { name: t('g.edit') })
    ).not.toBeInTheDocument()
  })

  it('offers no copy action on an attachment-only message', () => {
    renderMessage({ text: '', attachments: [{ name: 'clip.bin' }] })

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
