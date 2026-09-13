// @vitest-environment jsdom
import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

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

vi.mock<unknown>(import('@vueuse/core'), () => ({
  createSharedComposable: (composable: () => unknown) => composable,
  useClipboard: () => ({
    copy: clipboard.copy,
    copied: ref(false),
    isSupported: ref(true),
    text: ref('')
  }),
  useDocumentVisibility: () => ref('visible'),
  useStorage: (_key: string, defaultValue: unknown) => ref(defaultValue)
}))

const t = i18n.global.t

function renderMessage(props: ComponentProps<typeof UserMessage>) {
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
  it('shows references on attachment-only turns and disables unavailable ones', async () => {
    const view = renderMessage({
      text: '',
      attachments: [{ name: 'image.png', ref: 'image.png' }],
      workflowReferences: [
        {
          id: 'missing',
          name: 'Deleted workflow',
          unavailable: true,
          textOffset: 0
        },
        { id: 'available', name: 'Available', textOffset: 0 }
      ]
    })
    const unavailable = screen.getByRole('button', {
      name: 'Deleted workflow (unavailable)'
    })
    expect(unavailable).toHaveAttribute('aria-disabled', 'true')
    expect(unavailable).toHaveAttribute(
      'aria-description',
      t('agent.workflowReferenceUnavailableReason')
    )
    await userEvent.tab()
    expect(unavailable).toHaveFocus()
    await userEvent.keyboard('{Enter} ')
    await userEvent.click(unavailable)
    expect(view.emitted().openReferenceWorkflow).toBeUndefined()
    await userEvent.click(
      screen.getByRole('button', { name: 'Open Available' })
    )
    expect(view.emitted().openReferenceWorkflow).toEqual([
      ['available', 'Available']
    ])
  })
  it('renders submitted workflow references inline with the prompt snapshot', () => {
    renderMessage({
      text: 'Use  and compare with  today.',
      workflowReferences: [
        { id: 'wf-1', name: 'Workflow 1', textOffset: 4 },
        { id: 'wf-2', name: 'Workflow 2', textOffset: 22 }
      ]
    })

    const bubble = screen.getByTestId('user-message-bubble')
    expect(bubble).toHaveTextContent(
      /^Use Workflow 1 and compare with Workflow 2 today\.$/
    )
    expect(
      within(bubble).getByRole('button', { name: 'Open Workflow 1' })
    ).toBeVisible()
    expect(
      within(bubble).getByRole('button', { name: 'Open Workflow 2' })
    ).toBeVisible()
  })

  it.for(['pointer', 'Enter', 'Space'])(
    'opens a sent workflow reference with %s',
    async (interaction) => {
      const view = renderMessage({
        text: 'Compare this',
        workflowReferences: [
          { id: 'wf-reference', name: 'Reference', textOffset: 0 }
        ]
      })

      const chip = screen.getByRole('button', { name: 'Open Reference' })
      if (interaction === 'pointer') await userEvent.click(chip)
      else {
        chip.focus()
        await userEvent.keyboard(interaction === 'Enter' ? '{Enter}' : ' ')
      }

      expect(view.emitted('openReferenceWorkflow')).toEqual([
        ['wf-reference', 'Reference']
      ])
    }
  )

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

    expect(emitted().edit).toEqual([[{ text: prompt, workflowReferences: [] }]])
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
