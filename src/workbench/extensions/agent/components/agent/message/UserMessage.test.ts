import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import { i18n } from '@/i18n'

import type { AgentMessages } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { toTurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { normalizeAgentTranscript } from '@/workbench/extensions/agent/services/agent/agentTranscript'

import UserMessage from './UserMessage.vue'

const clipboard = vi.hoisted(() => ({
  text: '',
  copy: vi.fn((value: string) => {
    clipboard.text = value
  })
}))

beforeEach(() => {
  clipboard.text = ''
  clipboard.copy.mockClear()
})

vi.mock<unknown>(import('@vueuse/core'), () => ({
  createSharedComposable: (composable: () => unknown) => composable,
  useClipboard: () => ({
    copy: clipboard.copy,
    copied: ref(false),
    isSupported: ref(true),
    text: ref('')
  }),
  useClipboardItems: () => ({
    copy: vi.fn(),
    copied: ref(false),
    isSupported: ref(false)
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

function stubbedAssets(): {
  url: string
  filename: string
  kind: string
  label?: string
}[] {
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
        { name: 'song.mp3', ref: 'upload_song.mp3', mediaUrl: 'blob:song' },
        {
          name: 'clip.mp4',
          ref: 'upload_clip.mp4',
          previewUrl: 'blob:poster',
          mediaUrl: 'blob:video'
        }
      ]
    })

    expect(stubbedAssets()).toEqual([
      { url: 'blob:a', filename: 'a.png', kind: 'image' },
      {
        url: 'blob:song',
        filename: 'upload_song.mp3',
        kind: 'audio',
        label: 'song.mp3'
      },
      {
        url: 'blob:video',
        filename: 'upload_clip.mp4',
        kind: 'video',
        label: 'clip.mp4'
      }
    ])
    expect(screen.getByText('use these')).toBeInTheDocument()
  })

  it("keeps a sent EXR's stored preview in the grid", () => {
    renderMessage({
      text: '',
      attachments: [
        {
          name: 'plate.exr',
          ref: 'a1b2c3',
          kind: 'image',
          previewUrl: '/api/assets/p-1/content'
        }
      ]
    })

    expect(stubbedAssets()).toEqual([
      {
        url: '/api/assets/p-1/content',
        filename: 'a1b2c3',
        kind: 'image',
        label: 'plate.exr'
      }
    ])
  })

  it('never points a sent EXR without a stored preview at its raw file', () => {
    renderMessage({
      text: '',
      attachments: [{ name: 'plate.exr', ref: 'a1b2c3', kind: 'image' }]
    })

    expect(screen.queryByTestId('reply-asset-group')).not.toBeInTheDocument()
    expect(screen.getByText('plate.exr')).toBeInTheDocument()
  })

  // Dragging a non-first batch output (e.g. "layer 2" of a multi-output job)
  // into the composer attaches it with `ref` set to the bare output filename
  // (no content hash — see outputAssetUtil.ts's deliberate omission) and a
  // correct `previewUrl` captured at drop time. splitAttachments must prefer
  // that previewUrl over reconstructing `/view?...&type=input`, which does
  // not resolve to the dragged output.
  it('shows the dragged batch output, not a type=input lookup, for a non-first output asset', () => {
    renderMessage({
      text: 'use this one',
      attachments: [
        {
          name: 'ComfyUI_00002_.png',
          ref: 'ComfyUI_00002_.png',
          previewUrl: 'blob:comfy/correct-batch-output-2'
        }
      ]
    })

    expect(stubbedAssets()).toEqual([
      {
        url: 'blob:comfy/correct-batch-output-2',
        filename: 'ComfyUI_00002_.png',
        kind: 'image'
      }
    ])
  })

  /** PM-1643 / PM-717: persisted kind classifies an extensionless ref. */
  it.for(['image', 'video', 'audio'])(
    'previews a rehydrated %s asset whose ref has no extension',
    (kind) => {
      const bareDigest = 'a'.repeat(64)
      const persisted: AgentMessages[number] = {
        id: 'row-1',
        thread_id: 'thread-1',
        seq: 1,
        role: 'user',
        status: 'complete',
        turn_id: 'turn-a',
        content: {
          text: 'upscale this',
          attachments: [bareDigest],
          attachment_refs: [{ name: bareDigest, id: 'asset-9', kind }]
        }
      }
      const { userAttachments } = normalizeAgentTranscript([persisted])

      renderMessage({
        text: 'upscale this',
        attachments: userAttachments.get(toTurnId('turn-a'))
      })

      const grid = screen.queryByTestId('reply-asset-group')
      expect(JSON.parse(grid?.dataset.assets ?? '[]')).toEqual([
        expect.objectContaining({ kind })
      ])
    }
  )

  it('uses the resolved kind for both a renamed grid asset and its lightbox identity', () => {
    renderMessage({
      text: '',
      attachments: [
        {
          name: 'renamed-video.mp4',
          ref: 'stored-image.png',
          kind: 'video'
        }
      ]
    })

    expect(stubbedAssets()).toEqual([
      {
        url: expect.stringContaining(
          '/view?filename=stored-image.png&type=input'
        ),
        filename: 'stored-image.png',
        kind: 'video',
        label: 'renamed-video.mp4'
      }
    ])
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
        filename: 'upload_song.mp3',
        kind: 'audio',
        label: 'song.mp3'
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
    expect(await screen.findByTestId('tooltip-content')).toHaveTextContent(
      t('agent.copy')
    )
    await user.click(copyButton)

    expect(clipboard.copy).toHaveBeenCalledWith('make it cinematic')
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })

  it('copies a reference-only message with readable workflow names', async () => {
    renderMessage({
      text: '',
      workflowReferences: [{ id: 'wf', name: 'Portrait', textOffset: 0 }]
    })
    await userEvent.click(screen.getByRole('button', { name: t('agent.copy') }))
    expect(clipboard.text).toBe('@[Workflow: Portrait]')
  })

  it.for([true, false])(
    'respects Edit eligibility for a workflow-reference-only message: %s',
    async (editable) => {
      const workflowReferences = [{ id: 'wf', name: 'Portrait', textOffset: 0 }]
      const { emitted } = renderMessage({
        text: '',
        workflowReferences,
        editable
      })
      if (!editable) {
        expect(
          screen.queryByRole('button', { name: t('g.edit') })
        ).not.toBeInTheDocument()
        return
      }

      await userEvent.click(screen.getByRole('button', { name: t('g.edit') }))
      expect(emitted().edit).toEqual([[{ text: '', workflowReferences }]])
    }
  )

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
    expect(await screen.findByTestId('tooltip-content')).toHaveTextContent(
      t('g.edit')
    )
    await user.click(editButton)

    expect(emitted().edit).toEqual([[{ text: prompt, workflowReferences: [] }]])
  })

  it('does not offer edit for a settled prompt without edit eligibility', () => {
    renderMessage({ text: 'make it cinematic' })

    expect(
      screen.queryByRole('button', { name: t('g.edit') })
    ).not.toBeInTheDocument()
  })

  it('copies the filename on an attachment-only message', async () => {
    renderMessage({ text: '', attachments: [{ name: 'clip.bin' }] })

    await userEvent.click(screen.getByRole('button', { name: t('agent.copy') }))
    expect(clipboard.text).toBe('@[File: clip.bin]')
  })

  it('shows a sending spinner for a pending send and hides error alerts (O0-01)', () => {
    renderMessage({
      text: 'sending prompt',
      pending: { clientMessageId: 'cm-1', status: 'sending' }
    })

    expect(
      screen.getByRole('status', { name: t('agent.sendingMessage') })
    ).toBeVisible()
    expect(screen.getByTestId('pending-send-spinner')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
    expect(screen.queryByTestId('pending-send-error')).toBeNull()
  })

  it('keeps a persistent role="status" container mounted while toggling sr-only text on state change', async () => {
    const view = renderMessage({
      text: 'sending prompt',
      pending: { clientMessageId: 'cm-live', status: 'sending' }
    })

    const status = screen.getByRole('status', {
      name: t('agent.sendingMessage')
    })
    expect(status).toHaveTextContent(t('agent.sendingMessage'))
    expect(status).toHaveClass('sr-only')
    expect(screen.getByTestId('pending-send-spinner')).toHaveAttribute(
      'aria-hidden',
      'true'
    )

    await view.rerender({
      text: 'sending prompt',
      pending: undefined
    })

    expect(status).toBeInTheDocument()
    expect(status).toHaveTextContent('')
    expect(status).not.toHaveAttribute('aria-label')
    expect(screen.queryByTestId('pending-send-spinner')).toBeNull()
  })

  it('shows a sending spinner even on an attachment-only pending send (O0-01)', () => {
    renderMessage({
      text: '',
      attachments: [{ name: 'clip.bin' }],
      pending: { clientMessageId: 'cm-1', status: 'sending' }
    })

    expect(
      screen.getByRole('status', { name: t('agent.sendingMessage') })
    ).toBeVisible()
  })

  it('shows the failure explanation and no spinner when a pending send fails (O0-04)', async () => {
    const view = renderMessage({
      text: 'failed prompt',
      pending: {
        clientMessageId: 'cm-2',
        status: 'sending'
      }
    })

    await view.rerender({
      text: 'failed prompt',
      pending: {
        clientMessageId: 'cm-2',
        status: 'failed',
        failure: {
          kind: 'network',
          message:
            "Message didn't reach the server. Check your connection and try again."
        }
      }
    })

    expect(
      screen.queryByRole('status', { name: t('agent.sendingMessage') })
    ).toBeNull()
    const status = screen.getByTestId('pending-send-error')
    expect(status).toHaveAttribute('role', 'alert')
    expect(status).toHaveTextContent(
      "Message didn't reach the server. Check your connection and try again."
    )
    expect(screen.getByRole('button', { name: t('g.retry') })).toBeEnabled()
    expect(screen.getByRole('button', { name: t('g.delete') })).toBeEnabled()
  })

  it('uses status role when already failed on mount and emits Retry and Delete', async () => {
    const { emitted } = renderMessage({
      text: 'failed prompt',
      pending: {
        clientMessageId: 'cm-2',
        status: 'failed',
        failure: {
          kind: 'request',
          message: 'Message failed to send: server exploded'
        }
      }
    })

    expect(screen.getByTestId('pending-send-error')).toHaveAttribute(
      'role',
      'status'
    )
    await userEvent.click(screen.getByRole('button', { name: t('g.retry') }))
    await userEvent.click(screen.getByRole('button', { name: t('g.delete') }))
    expect(emitted().retryPending).toEqual([['cm-2']])
    expect(emitted().deletePending).toEqual([['cm-2']])
  })

  it.for(['admission', 'request', 'turn_in_progress'] as const)(
    'shows failure copy with Retry and Delete for %s',
    (kind) => {
      const message = `Failure for ${kind}`
      renderMessage({
        text: 'prompt',
        pending: {
          clientMessageId: `cm-${kind}`,
          status: 'failed',
          failure: { kind, message }
        }
      })

      expect(screen.getByTestId('pending-send-error')).toHaveTextContent(
        message
      )
      expect(screen.getByRole('button', { name: t('g.retry') })).toBeEnabled()
      expect(screen.getByRole('button', { name: t('g.delete') })).toBeEnabled()
    }
  )

  it.for(['disowned', 'target_unavailable'] as const)(
    'offers New chat and Delete instead of Retry for %s (O0-04)',
    async (kind) => {
      const { emitted } = renderMessage({
        text: 'lost workflow',
        pending: {
          clientMessageId: `cm-${kind}`,
          status: 'failed',
          failure: { kind, message: 'This workflow is no longer available.' }
        }
      })

      expect(screen.queryByRole('button', { name: t('g.retry') })).toBeNull()
      await userEvent.click(
        screen.getByRole('button', { name: t('agent.newChat') })
      )
      await userEvent.click(screen.getByRole('button', { name: t('g.delete') }))
      expect(emitted().newChat).toEqual([[]])
      expect(emitted().deletePending).toEqual([[`cm-${kind}`]])
    }
  )

  it('renders AgentPaywallCard for paywall failures and hides it when paywallResolved (O0-04)', async () => {
    const view = renderMessage({
      text: 'needs credits',
      paywallPresentation: { kind: 'local' },
      pending: {
        clientMessageId: 'cm-pay',
        status: 'failed',
        failure: {
          kind: 'paywall',
          message: "You're out of credits."
        },
        paywallResolved: false
      }
    })

    expect(
      screen.getByRole('button', { name: t('agent.paywall.addCredits') })
    ).toBeVisible()
    await userEvent.click(
      screen.getByRole('button', { name: t('agent.paywall.addCredits') })
    )
    expect(view.emitted().paywallAction).toEqual([
      ['addCredits', 'refused_send']
    ])
    expect(screen.getByRole('button', { name: t('g.retry') })).toBeEnabled()
    expect(screen.getByRole('button', { name: t('g.delete') })).toBeEnabled()

    await view.rerender({
      text: 'needs credits',
      paywallPresentation: { kind: 'local' },
      pending: {
        clientMessageId: 'cm-pay',
        status: 'failed',
        failure: {
          kind: 'paywall',
          message: "You're out of credits."
        },
        paywallResolved: true
      }
    })

    expect(
      screen.queryByRole('button', { name: t('agent.paywall.addCredits') })
    ).toBeNull()
    expect(screen.getByRole('button', { name: t('g.retry') })).toBeEnabled()
  })

  it('hides Retry when failure.retryable is false while keeping Delete (O0-04 unreadable ack)', () => {
    renderMessage({
      text: 'unreadable response',
      pending: {
        clientMessageId: 'cm-unreadable',
        status: 'failed',
        failure: {
          kind: 'request',
          message: 'Message failed to send: Unreadable agent response body',
          retryable: false
        }
      }
    })

    expect(screen.getByTestId('pending-send-error')).toHaveTextContent(
      'Message failed to send: Unreadable agent response body'
    )
    expect(screen.queryByRole('button', { name: t('g.retry') })).toBeNull()
    expect(screen.getByRole('button', { name: t('g.delete') })).toBeEnabled()
  })
})
