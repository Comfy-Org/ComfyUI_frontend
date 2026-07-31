// @vitest-environment jsdom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

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
  attachments?: { name: string; previewUrl?: string }[]
  tags?: string[]
}) {
  return render(UserMessage, { props, global: { plugins: [i18n] } })
}

describe('UserMessage', () => {
  it('renders a caption-only placeholder tile for a preview-less attachment', () => {
    renderMessage({ text: '', attachments: [{ name: 'clip.bin' }] })

    expect(screen.getByText('clip.bin')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders thumbnails for previewable attachments above the text pill', () => {
    renderMessage({
      text: 'use these',
      attachments: [
        { name: 'a.png', previewUrl: 'blob:a' },
        { name: 'b.png', previewUrl: 'blob:b' }
      ]
    })

    expect(screen.getByAltText('a.png')).toBeInTheDocument()
    expect(screen.getByAltText('b.png')).toBeInTheDocument()
    expect(screen.getByText('use these')).toBeInTheDocument()
  })

  it('reveals the copy action on hover and copies the exact prompt', async () => {
    const user = userEvent.setup()
    renderMessage({ text: 'make it cinematic' })

    await user.hover(screen.getByText('make it cinematic'))
    await user.click(screen.getByRole('button', { name: t('agent.copy') }))

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

  it('offers no copy action on an attachment-only message', () => {
    renderMessage({ text: '', attachments: [{ name: 'clip.bin' }] })

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
