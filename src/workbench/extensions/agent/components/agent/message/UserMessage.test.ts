import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import { i18n } from '@/i18n'

import type { AgentMessages } from '../../../schemas/agentApiSchema'
import { toTurnId } from '../../../schemas/agentApiSchema'
import { normalizeAgentTranscript } from '../../../services/agent/agentTranscript'
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

  /**
   * PM-1643 / PM-717 item 3. Dragging a library asset in attaches it under
   * `getAssetUrlFilename`, i.e. `asset.hash` (assetDragUtil.ts,
   * assetMetadataUtils.ts). Cloud keys an upload as
   * `hash + filepath.Ext(filename)`, so an extensionless name yields a bare
   * digest for a key. `/api/upload/image` cannot get there — it runs
   * `ensureUploadExtension`, which appends `.bin` — but `POST /api/assets`
   * normalizes no extension, only `ValidateFilePath`, which permits a name
   * without one; bare hex is a first-class storage-key shape there
   * (common/assets/repository_impl.go). A later name-only
   * `PUT /api/assets/{id}` then sets `Name` and never touches `Hash`, leaving
   * a displayable name — which is what clears the non-'other' gate on the
   * drag — over an extensionless ref. Create-time cannot desynchronize the
   * two, since the row's name and the hash's extension come off the same
   * string, so this needs that direct PUT and no shipped client issues one
   * today; the component gap it exposes does not depend on the route. Live an image also carries the
   * `previewUrl` captured at drop, and video and audio still reach the grid
   * on the reconstructed `/view` URL because the gate read their displayable
   * name; after a refresh only the ref survives, `getMediaTypeFromFilename`
   * finds no extension on it and answers 'other', and all three drop to a
   * grey tile.
   *
   * The service resolved and persisted the kind on `attachment_refs`, so the
   * fact needed to classify it did survive the round trip — `UserMessage` is
   * simply not given it, because `parseUserAttachments` drops it. Closing the
   * sibling pin in agentTranscript.test.ts is therefore necessary but not
   * sufficient for this one: the component must also prefer the resolved kind
   * over the extension it infers.
   *
   * Run over the service's whole kind vocabulary so that assuming any single
   * kind for an unclassifiable ref cannot discharge it. Props come from the
   * real parser rather than being written by hand, so no assumption about the
   * repaired `UserAttachment` shape is baked in. Only `kind` is asserted: a
   * repair that also restores the human-readable filename would change
   * `filename` here, and should retire this pin rather than be failed by it.
   */
  it.fails.for(['image', 'video', 'audio'])(
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

  it('copies the filename on an attachment-only message', async () => {
    renderMessage({ text: '', attachments: [{ name: 'clip.bin' }] })

    await userEvent.click(screen.getByRole('button', { name: t('agent.copy') }))
    expect(clipboard.text).toBe('@[File: clip.bin]')
  })
})
