import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import { i18n } from '@/i18n'
import { listSkillPacks } from '@/platform/skills/api/skillsApi'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import { useAgentComposerStore } from '../../../stores/agent/agentComposerStore'
import type { ReplyAsset } from '../../../utils/replyAssets'
import Composer from '../Composer.vue'
import { setupInlinePromptEditorDom } from '../composer/inlinePromptEditorTestSetup'
import UserMessage from './UserMessage.vue'

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/platform/skills/api/skillsApi'), { spy: true })
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('./ReplyAssetGroup.vue'), () => ({
  default: defineComponent<{ assets: ReplyAsset[] }>({
    setup: () => () => null
  })
}))

setupInlinePromptEditorDom()

// jsdom lacks ClipboardItem; user-event provides the clipboard itself.
class TestClipboardItem {
  constructor(
    private readonly data: Record<
      string,
      Blob | string | Promise<Blob | string>
    >
  ) {}

  get types() {
    return Object.keys(this.data)
  }

  async getType(type: string): Promise<Blob> {
    const value = await this.data[type]
    return typeof value === 'string' ? new Blob([value], { type }) : value
  }
}

function renderComposer() {
  const store = useAgentComposerStore()
  const onSend = vi.fn<NonNullable<ComponentProps<typeof Composer>['onSend']>>()
  render(Composer, {
    props: { hasWorkflowTarget: true, editableWorkflowId: 'target-A', onSend },
    global: { plugins: [i18n], directives: { tooltip: () => {} } }
  })
  return { store, onSend, editor: screen.getByRole('textbox') }
}

describe('sent message workflow clipboard', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.stubGlobal('ClipboardItem', TestClipboardItem)
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'permissions')
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: async () =>
          Object.assign(new EventTarget(), { state: 'granted' })
      }
    })
    return () => {
      if (descriptor)
        Object.defineProperty(navigator, 'permissions', descriptor)
      else Reflect.deleteProperty(navigator, 'permissions')
    }
  })

  it('copies a sent message and restores workflows at the caret with readable node and asset labels', async () => {
    const user = userEvent.setup()
    const references = [
      { id: 'workflow-B', name: '参考 <B> 🐈', textOffset: 4 },
      { id: 'workflow-C', name: 'Missing', textOffset: 7, unavailable: true }
    ]
    render(UserMessage, {
      props: {
        text: 'Use \n  !',
        workflowReferences: references,
        tags: ['Sampler #12'],
        attachments: [{ name: 'notes.txt' }]
      },
      global: { plugins: [i18n] }
    })
    const { store, editor } = renderComposer()
    await user.click(
      screen.getByRole('button', { name: i18n.global.t('agent.copy') })
    )
    expect(await navigator.clipboard.readText()).toBe(
      'Use @[Workflow: 参考 <B> 🐈]\n  @[Workflow: Missing]!\n@[Node: Sampler #12]\n@[File: notes.txt]'
    )

    await user.click(editor)
    await user.paste('New: ')
    expect(store.draft).toBe('New: ')
    await user.paste()
    expect(store.draft).toBe(
      'New: Use \n  !\n@[Node: Sampler #12]\n@[File: notes.txt]'
    )
    expect(store.workflowReferences).toEqual(
      references.map((reference) => ({
        ...reference,
        textOffset: reference.textOffset + 5
      }))
    )
    expect(store.nodes).toEqual([])
    expect(store.attachments).toEqual([])
    await user.keyboard('{Control>}z{/Control}')
    expect(store.draft).toBe('New: ')
    expect(store.workflowReferences).toEqual([])
  })

  it('copies only selected content and treats a partially selected workflow label as one reference', async () => {
    const user = userEvent.setup()
    render(UserMessage, {
      props: {
        text: 'Before  between  after',
        workflowReferences: [
          { id: 'workflow-B', name: 'Reference B', textOffset: 7 },
          { id: 'workflow-C', name: 'Reference C', textOffset: 16 }
        ]
      },
      global: { plugins: [i18n] }
    })
    await user.tab()
    const label = document
      .createTreeWalker(screen.getByText('Reference B'), NodeFilter.SHOW_TEXT)
      .nextNode()
    if (!label) throw new Error('Expected workflow label text')
    const range = document.createRange()
    range.setStart(label, 2)
    range.setEndBefore(screen.getByRole('button', { name: 'Open Reference C' }))
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(range)
    const clipboard = await user.copy()
    expect(clipboard?.getData('text/plain')).toBe(
      '@[Workflow: Reference B] between '
    )

    const { store, editor } = renderComposer()
    await user.click(editor)
    await user.paste(clipboard)
    expect(store.draft).toBe(' between ')
    expect(store.workflowReferences).toEqual([
      { id: 'workflow-B', name: 'Reference B', textOffset: 0 }
    ])
  })

  it('keeps current-target and duplicate workflow references as readable text', async () => {
    const user = userEvent.setup()
    render(UserMessage, {
      props: {
        text: ' and ',
        workflowReferences: [
          { id: 'target-A', name: 'Target', textOffset: 0 },
          { id: 'workflow-B', name: 'Reference B', textOffset: 5 }
        ]
      },
      global: { plugins: [i18n] }
    })
    await user.click(
      screen.getByRole('button', { name: i18n.global.t('agent.copy') })
    )
    const { store, editor } = renderComposer()
    store.replaceDraft({
      text: 'Existing: ',
      workflowReferences: [
        { id: 'workflow-B', name: 'Reference B', textOffset: 0 }
      ],
      attachments: []
    })
    await waitFor(() =>
      expect(editor).toHaveTextContent('Reference BExisting:')
    )
    await user.click(editor)
    await user.keyboard('{Control>}a{/Control}{ArrowRight}')
    await user.paste()
    expect(store.draft).toBe(
      'Existing: @[Workflow: Target] and @[Workflow: Reference B]'
    )
    expect(store.workflowReferences).toEqual([
      { id: 'workflow-B', name: 'Reference B', textOffset: 0 }
    ])
  })

  it('leaves a selection spanning outside the message to native copying', async () => {
    const user = userEvent.setup()
    render(UserMessage, {
      props: {
        text: ' after',
        workflowReferences: [
          { id: 'workflow-B', name: 'Reference B', textOffset: 0 }
        ]
      },
      global: { plugins: [i18n] }
    })
    render({ template: '<p>Outside message</p>' })
    await user.tab()
    const range = document.createRange()
    range.setStartBefore(
      screen.getByRole('button', { name: 'Open Reference B' })
    )
    range.setEndAfter(screen.getByText('Outside message'))
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(range)
    const selectedText = range.toString()
    const clipboard = await user.copy()
    expect(clipboard?.getData('text/plain')).toBe(selectedText)
    expect(clipboard?.getData('text/plain')).toContain('Outside message')
  })

  it('falls back to readable text when rich clipboard writing is rejected', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'write').mockRejectedValueOnce(
      new Error('Clipboard denied')
    )
    render(UserMessage, {
      props: {
        text: '',
        workflowReferences: [
          { id: 'workflow-B', name: 'Reference B', textOffset: 0 }
        ]
      },
      global: { plugins: [i18n] }
    })
    await user.click(
      screen.getByRole('button', { name: i18n.global.t('agent.copy') })
    )
    expect(await navigator.clipboard.readText()).toBe(
      '@[Workflow: Reference B]'
    )
    expect(
      screen.getByRole('button', { name: i18n.global.t('agent.copied') })
    ).toBeVisible()
  })

  it.for<{
    operation: string
    copy: (
      user: UserEvent
    ) => Promise<{ copiedText: string; pasteData: DataTransfer | undefined }>
    copiedText: string
    editorText: string
    contentBefore: string
    contentAfter: string
    markerOffset: number
  }>([
    {
      operation: 'button',
      copy: async (user) => {
        await user.click(
          screen.getByRole('button', { name: i18n.global.t('agent.copy') })
        )
        return {
          copiedText: await navigator.clipboard.readText(),
          pasteData: undefined
        }
      },
      copiedText: 'Before /portrait.v2@[Workflow: Reference B] after',
      editorText: 'Before /portrait.v2Reference B after',
      contentBefore: 'Before ',
      contentAfter: ' after',
      markerOffset: 7
    },
    {
      operation: 'selection',
      copy: async (user) => {
        await user.tab()
        const label = document
          .createTreeWalker(
            screen.getByTestId('skill-reference'),
            NodeFilter.SHOW_TEXT
          )
          .nextNode()
        assert.exists(label)
        const range = document.createRange()
        range.setStart(label, 3)
        range.setEndAfter(
          screen.getByRole('button', { name: 'Open Reference B' })
        )
        document.getSelection()?.removeAllRanges()
        document.getSelection()?.addRange(range)
        const clipboard = await user.copy()
        assert.exists(clipboard)
        return {
          copiedText: clipboard.getData('text/plain'),
          pasteData: clipboard
        }
      },
      copiedText: '/portrait.v2@[Workflow: Reference B]',
      editorText: '/portrait.v2Reference B',
      contentBefore: '',
      contentAfter: '',
      markerOffset: 0
    }
  ])(
    'copies a deleted skill through $operation and preserves its description and adjacent workflows on resend',
    async ({
      copy,
      copiedText,
      editorText,
      contentBefore,
      contentAfter,
      markerOffset
    }) => {
      const user = userEvent.setup()
      render(UserMessage, {
        props: {
          text: 'Before  after',
          workflowReferences: [
            { id: 'workflow-B', name: 'Reference B', textOffset: 7 }
          ],
          skillReference: {
            name: 'portrait.v2',
            description: 'Original\nDescription',
            textOffset: 7,
            workflowIndex: 0
          }
        },
        global: { plugins: [i18n] }
      })
      const copied = await copy(user)
      expect(copied.copiedText).toBe(copiedText)
      const skills = useSkillPacksStore()
      skills.flagsEnabled = true
      vi.spyOn(skills, 'startFlagGate').mockResolvedValue()
      vi.mocked(listSkillPacks).mockResolvedValue([])
      const { editor, onSend } = renderComposer()
      await user.click(editor)
      await user.paste(copied.pasteData)
      await waitFor(() => expect(skills.catalogConfirmed).toBe(true))
      expect(editor).toHaveTextContent(editorText)
      await user.click(screen.getByRole('button', { name: 'Send' }))
      const marker =
        '[Use the saved skill /portrait.v2](skill://portrait.v2?description=Original%0ADescription)'
      expect(onSend).toHaveBeenCalledExactlyOnceWith(
        `${contentBefore}${marker}${contentAfter}`,
        [],
        [
          {
            id: 'workflow-B',
            name: 'Reference B',
            textOffset: markerOffset + marker.length
          }
        ]
      )
    }
  )
})
