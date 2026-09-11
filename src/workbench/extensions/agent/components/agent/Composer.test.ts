// @vitest-environment jsdom

import type {
  WorkflowReference,
  WorkflowReferenceMetadata,
  WorkflowReferenceOption
} from '../../types/workflowReference'
import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { DirectiveBinding } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import * as tooltipConfig from '@/composables/useTooltipConfig'
import { i18n } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAgentRunModeStore } from '../../stores/agent/agentRunModeStore'
import Composer from './Composer.vue'
import { setupInlinePromptEditorDom } from './composer/inlinePromptEditorTestSetup'

setupInlinePromptEditorDom()

const tooltipBindings = new WeakMap<Element, unknown>()
const tooltipDirectiveStub = {
  mounted(element: Element, binding: DirectiveBinding<unknown>) {
    tooltipBindings.set(element, binding.value)
  },
  updated(element: Element, binding: DirectiveBinding<unknown>) {
    tooltipBindings.set(element, binding.value)
  }
}

const fetchApi = vi.hoisted(() =>
  vi.fn<(route: string, init?: RequestInit) => Promise<Response>>()
)
vi.mock<unknown>(import('@/scripts/api'), () => ({ api: { fetchApi } }))

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function mount(
  {
    workflowReferences,
    ...props
  }: ComponentProps<typeof Composer> & {
    workflowReferences?: WorkflowReference[]
  } = {},
  attrs: Record<string, unknown> = {}
) {
  if (workflowReferences)
    useAgentComposerStore().setWorkflowReferences(workflowReferences)
  const selectWorkflowReference = vi.fn(
    async (workflow: WorkflowReferenceOption) => ({
      id: workflow.id ?? 'saved-scratch',
      name: workflow.name
    })
  )
  const view = render(Composer, {
    props: { hasWorkflowTarget: true, selectWorkflowReference, ...props },
    attrs,
    global: {
      plugins: [i18n],
      directives: { tooltip: tooltipDirectiveStub }
    }
  })
  return { ...view, selectWorkflowReference }
}

describe('Composer', () => {
  it.for(['@unmatched text', '@Nodes unmatched'])(
    'sends an unmatched mention query with Enter: %s',
    async (text) => {
      const view = mount()
      await userEvent.type(screen.getByRole('textbox'), `${text}{Enter}`)
      expect(view.emitted().send).toHaveLength(1)
    }
  )
  it('skips the disabled Nodes section during keyboard selection', async () => {
    mount({
      nodeReferenceDisabledReason: 'Please select a workflow first',
      availableWorkflows: [{ id: 'ref', name: 'Reference' }]
    })
    await userEvent.type(screen.getByRole('textbox'), '@{Enter}')
    expect(screen.getByRole('menuitem', { name: 'Reference' })).toBeVisible()
  })
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('preserves new input on Enter while a previous send is submitting', async () => {
    const { emitted } = mount({ submitting: true })
    const textbox = screen.getByRole('textbox')
    await userEvent.type(textbox, 'Next draft{Enter}')
    expect(useAgentComposerStore().draft).toBe('Next draft')
    expect(emitted().send).toBeUndefined()
  })

  it('blocks all node entry points and explains why while workflow references remain available', async () => {
    const reason = 'Please select a workflow first'
    const props = {
      nodeReferenceDisabledReason: reason,
      getMentionNodes: () => [{ id: '7', title: 'KSampler' }]
    }
    const { emitted } = mount(props)
    const inline = screen.getByRole('button', {
      name: 'mention nodes'
    })
    expect(inline).toHaveAttribute('aria-disabled', 'true')
    expect(inline).toHaveAccessibleDescription(reason)
    await userEvent.click(inline)
    expect(emitted().selectNodes).toBeUndefined()

    await userEvent.click(screen.getByRole('button', { name: 'Add to prompt' }))
    const plusNodes = screen.getByRole('menuitem', { name: 'Nodes' })
    expect(plusNodes).toHaveAttribute('aria-disabled', 'true')
    expect(plusNodes).toHaveAccessibleDescription(reason)
    await userEvent.click(plusNodes)
    expect(emitted().selectNodes).toBeUndefined()
    await userEvent.keyboard('{Escape}')

    const input = screen.getByRole('textbox')
    await userEvent.type(input, '@')
    const nodes = screen.getByRole('menuitem', { name: 'Nodes' })
    expect(nodes).toHaveAttribute('aria-disabled', 'true')
    expect(nodes).toHaveAccessibleDescription(reason)
    await userEvent.keyboard('{Enter}')
    expect(screen.queryByRole('menuitem', { name: 'KSampler' })).toBeNull()
    expect(screen.getByRole('menuitem', { name: 'Back' })).toBeVisible()
    expect(emitted().requestWorkflowReferences).toHaveLength(1)
    expect(emitted().mentionPick).toBeUndefined()
  })

  it('invalidates an open Nodes submenu when the viewed workflow becomes ineligible', async () => {
    const { rerender, emitted } = mount({
      getMentionNodes: () => [{ id: '7', title: 'KSampler' }]
    })
    await userEvent.type(screen.getByRole('textbox'), '@')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('menuitem', { name: 'KSampler' })).toBeVisible()
    await rerender({
      nodeReferenceDisabledReason: 'Switch to Portrait to add nodes.'
    })
    expect(screen.queryByRole('menuitem', { name: 'KSampler' })).toBeNull()
    expect(screen.getByRole('menuitem', { name: 'Nodes' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    await userEvent.keyboard('{Enter}')
    expect(emitted().mentionPick).toBeUndefined()
  })

  it('T-21 / PM-678 / FE-1325 hints at ideas, canvas references, and dragged assets', () => {
    mount()

    const text = screen.getByText(
      'Describe ideas, @ to reference workflows, drag in media asset and files, or'
    )
    expect(text).toBeVisible()
    const addNodes = screen.getByRole('button', {
      name: 'mention nodes'
    })
    expect(addNodes).toBeVisible()
    expect(addNodes).toContainHTML(
      '<span class="icon-[lucide--mouse-pointer-click] size-[14px] shrink-0"></span>'
    )
    expect(
      text.compareDocumentPosition(addNodes) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('hides the empty-composer hint once typing begins', async () => {
    mount()
    const box = screen.getByRole('textbox')

    await userEvent.type(box, 'hello')

    expect(useAgentComposerStore().draft).toBe('hello')
    expect(screen.queryByRole('button', { name: 'mention nodes' })).toBeNull()
  })

  it('enters graph selection mode from the empty-composer hint', async () => {
    const getMentionNodes = vi.fn(() => [])
    const { emitted } = mount({ getMentionNodes })
    const hintButton = screen.getByRole('button', {
      name: 'mention nodes'
    })

    await userEvent.tab()
    await userEvent.tab()
    expect(hintButton).toHaveFocus()
    await userEvent.keyboard('{Enter}')

    expect(emitted().selectNodes).toHaveLength(1)
    expect(getMentionNodes).not.toHaveBeenCalled()
  })

  it('retains the draft on Enter while a workflow selection is saving', async () => {
    const { emitted, rerender } = mount({ workflowSelecting: true })
    const box = screen.getByRole('textbox')
    await userEvent.type(box, 'keep this draft{Enter}')
    expect(useAgentComposerStore().draft).toBe('keep this draft')
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(emitted().send).toBeUndefined()

    await rerender({ workflowSelecting: false })
    expect(emitted().send).toBeUndefined()
    await userEvent.keyboard('{Enter}')
    expect(emitted().send).toHaveLength(1)
  })

  it('disables send when empty and enables once text is typed', async () => {
    mount()
    const send = screen.getByRole('button', { name: 'Send' })
    expect(send).toBeDisabled()

    await userEvent.hover(send)
    expect(
      await screen.findByRole('tooltip', { hidden: true })
    ).toHaveTextContent('Add a prompt to send')
    await userEvent.unhover(send)

    await userEvent.type(screen.getByRole('textbox'), 'hello')
    expect(send).toBeEnabled()

    await userEvent.hover(send)
    expect(
      await screen.findByRole('tooltip', { hidden: true })
    ).toHaveTextContent('Send')
  })

  it('renders without vue-i18n message compilation errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mount({ canAttach: true, canOpenAssets: true })

    // The menu strings only compile once reka mounts the lazy menu content.
    await openAddMenu()
    await screen.findByRole('menuitem', { name: 'Upload images or files' })

    // Unescaped syntax characters (@, |, {) in a locale message compile to an
    // error and silently fall back to the raw string.
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain(
      'Message compilation error'
    )

    consoleError.mockRestore()
  })

  it('emits trimmed text and leaves the draft for the submission owner', async () => {
    const { emitted } = mount()
    const box = screen.getByRole('textbox')
    await userEvent.type(box, '  make art  ')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(emitted().send[0]).toEqual(['make art', []])
    expect(useAgentComposerStore().draft).toBe('  make art  ')
  })

  it('sends on Enter but not on Shift+Enter', async () => {
    const { emitted } = mount()
    const box = screen.getByRole('textbox')
    await userEvent.type(box, 'one{Shift>}{Enter}{/Shift}two')
    expect(emitted().send).toBeUndefined()
    await userEvent.type(box, '{Enter}')
    expect(emitted().send).toHaveLength(1)
  })

  it('shows Stop while streaming and emits stop instead of send', async () => {
    const { emitted } = mount({ streaming: true })
    const stop = screen.getByRole('button', { name: 'Stop' })
    await userEvent.click(stop)
    expect(emitted().stop).toHaveLength(1)
    expect(emitted().send).toBeUndefined()
  })

  it('keeps Stop available while a workflow reference is saving', async () => {
    const { emitted } = mount({ streaming: true, workflowSelecting: true })
    const stop = screen.getByRole('button', { name: 'Stop' })
    expect(stop).toBeEnabled()
    await userEvent.click(stop)
    expect(emitted().stop).toHaveLength(1)
  })

  it('shows Stop instead of a spinner while submitting and emits stop', async () => {
    const { emitted } = mount({ submitting: true })
    const stop = screen.getByRole('button', { name: 'Stop' })
    await userEvent.click(stop)
    expect(emitted().stop).toHaveLength(1)
    expect(emitted().send).toBeUndefined()
  })

  describe('run permissions popover', () => {
    beforeEach(() => {
      localStorage.clear()
      fetchApi.mockReset()
      fetchApi.mockImplementation(async () =>
        jsonResponse(404, { error: 'not found' })
      )
    })

    it('opens from the mode control with the ask mode selected by default', async () => {
      mount()

      await userEvent.click(screen.getByRole('button', { name: 'Ask' }))

      expect(
        await screen.findByText('Choose when the agent needs your consent')
      ).toBeInTheDocument()
      expect(
        screen.getByRole('radio', { name: /Ask before a workflow runs/ })
      ).toBeChecked()
      expect(
        screen.getByRole('button', { name: 'Save changes' })
      ).toBeDisabled()
      expect(screen.getAllByRole('radio')).toHaveLength(2)
      expect(
        screen.queryByRole('radio', { name: /Auto-run with limits/ })
      ).not.toBeInTheDocument()
    })

    it('saves auto mode and closes', async () => {
      mount()
      const store = useAgentRunModeStore()

      await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
      await userEvent.click(
        await screen.findByRole('radio', { name: /Auto-run without approval/ })
      )
      const save = screen.getByRole('button', { name: 'Save changes' })
      expect(save).toBeEnabled()
      await userEvent.click(save)
      await vi.waitFor(() => expect(store.mode).toBe('auto'))
      await nextTick()

      expect(
        screen.queryByText('Choose when the agent needs your consent')
      ).toBeNull()
      expect(
        await screen.findByRole('button', { name: 'Auto' })
      ).toBeInTheDocument()
      expect(store.mode).toBe('auto')
      expect(store.creditLimit).toBeNull()
    })

    it('keeps the popover open and reports a failed save', async () => {
      fetchApi.mockResolvedValueOnce(jsonResponse(500, { error: 'failed' }))
      mount()

      await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
      await userEvent.click(
        await screen.findByRole('radio', { name: /Auto-run without approval/ })
      )
      await userEvent.click(
        screen.getByRole('button', { name: 'Save changes' })
      )

      expect(
        await screen.findByText('Choose when the agent needs your consent')
      ).toBeInTheDocument()
      expect(useAgentRunModeStore().mode).toBe('ask_approval')
      expect(useToastStore().messagesToAdd).toContainEqual({
        severity: 'error',
        detail: i18n.global.t('agent.runModeSaveFailed')
      })
    })

    it('keeps unlimited auto mode distinct from limited auto mode', async () => {
      const store = useAgentRunModeStore()
      await store.save('auto', null)

      mount()

      expect(screen.getByRole('button', { name: 'Auto' })).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Auto (limited)' })
      ).not.toBeInTheDocument()
    })

    it.for([
      ['ask_approval', 'Ask', 'Ask for permission'],
      ['auto', 'Auto', 'Run workflow without permission'],
      ['auto_limited', 'Auto (limited)', 'Ask when credit limit is reached']
    ] as const)(
      'shows the %s mode tooltip copy',
      async ([mode, triggerName, tooltipCopy]) => {
        await useAgentRunModeStore().save(
          mode,
          mode === 'auto_limited' ? 450 : null
        )
        mount()

        const trigger = screen.getByRole('button', { name: triggerName })
        expect(tooltipBindings.get(trigger)).toEqual(
          tooltipConfig.buildAgentTooltipConfig(tooltipCopy)
        )
      }
    )

    it('discards an unsaved draft when the popover closes without saving', async () => {
      mount()
      const store = useAgentRunModeStore()

      await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
      await userEvent.click(
        await screen.findByRole('radio', { name: /Auto-run without approval/ })
      )
      await userEvent.keyboard('{Escape}')
      expect(store.mode).toBe('ask_approval')

      await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
      expect(
        await screen.findByRole('radio', { name: /Ask before a workflow runs/ })
      ).toBeChecked()
    })
  })

  describe('typed @ mention', () => {
    const NODES = [
      { id: '5', title: 'KSampler' },
      { id: '7', title: 'KSampler' },
      { id: '9', title: 'VAE Decode' }
    ]

    async function openReferenceRoot(text = '@') {
      await userEvent.type(screen.getByRole('textbox'), text)
      return screen.getByRole('menu', { name: 'Add to prompt' })
    }

    async function openReferenceSection(
      section: 'Nodes' | 'Workflows',
      text = '@'
    ) {
      const menu = await openReferenceRoot()
      await userEvent.click(
        within(menu).getByRole('menuitem', { name: section })
      )
      if (text !== '@')
        await userEvent.type(screen.getByRole('textbox'), text.slice(1))
      return screen.getByRole('menu', { name: 'Add to prompt' })
    }

    it('opens a Reference menu with only Nodes and Workflows at the root', async () => {
      mount({
        getMentionNodes: () => NODES,
        availableWorkflows: [{ id: 'wf-water', name: 'Water world' }],
        canOpenAssets: true
      })

      const menu = await openReferenceRoot()

      expect(within(menu).getByText('Reference')).toBeVisible()
      expect(
        within(menu)
          .getAllByRole('menuitem')
          .map((item) => item.textContent.trim())
      ).toEqual(['Nodes', 'Workflows'])
      expect(within(menu).queryByText('KSampler')).toBeNull()
      expect(within(menu).queryByText('Water world')).toBeNull()
      expect(within(menu).queryByText('Add from assets panel')).toBeNull()
    })

    it('opens the Nodes submenu and lists matching nodes alphabetically', async () => {
      mount({
        getMentionNodes: () => [
          { id: '3', title: 'VAE Decode' },
          { id: '1', title: 'Alpha' },
          { id: '2', title: 'KSampler' }
        ]
      })

      const menu = await openReferenceSection('Nodes')

      expect(
        within(menu)
          .getAllByRole('menuitem')
          .map((item) => item.textContent.trim())
      ).toEqual(['Back', 'Alpha', 'KSampler', 'VAE Decode'])
    })

    // Re-picking a staged node is a no-op, so it drops out of the list.
    it('hides nodes already in the basket', async () => {
      mount({
        getMentionNodes: () => NODES,
        selectionTags: [NODES[0]]
      })

      const menu = await openReferenceSection('Nodes')

      const labels = within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent.trim())
      expect(labels).not.toContain(NODES[0].title)
      expect(labels).toEqual(['Back', 'KSampler #7', 'VAE Decode'])
    })

    // The staged node is only hidden from the picker, not from the duplicate
    // check - its chip must still show the id that tells it apart from the
    // same-titled node still in the graph.
    it('keeps disambiguating a staged node against its graph twin', async () => {
      const twin = { id: '11', title: NODES[0].title }
      mount({
        getMentionNodes: () => [...NODES, twin],
        selectionTags: [NODES[0]]
      })

      await openReferenceSection('Nodes')

      expect(screen.getByText(`#${NODES[0].id}`)).toBeInTheDocument()
    })

    it('keeps type-to-filter behavior inside the selected reference type', async () => {
      const { emitted } = mount({ getMentionNodes: () => NODES })

      const menu = await openReferenceSection('Nodes', '@vae de')
      expect(within(menu).getAllByRole('menuitem')).toHaveLength(2)
      expect(
        within(menu).getByRole('menuitem', { name: 'VAE Decode' })
      ).toHaveAttribute('data-active', 'true')

      await userEvent.keyboard('{Enter}')
      expect(emitted().mentionPick[0]).toEqual([NODES[2]])
      expect(emitted().send).toBeUndefined()
      expect(useAgentComposerStore().draft).toBe('')
    })

    it('navigates categories and submenu items with the keyboard', async () => {
      const workflow = { id: 'wf-water', name: 'Water world' }
      const { emitted, selectWorkflowReference } = mount({
        availableWorkflows: [workflow]
      })

      const root = await openReferenceRoot()
      const categories = within(root).getAllByRole('menuitem')
      expect(categories[0]).toHaveAttribute('data-active', 'true')
      await userEvent.keyboard('{ArrowDown}')
      expect(categories[1]).toHaveAttribute('data-active', 'true')
      await userEvent.keyboard('{Enter}')

      const submenu = screen.getByRole('menu', { name: 'Add to prompt' })
      expect(
        within(submenu).getByRole('menuitem', { name: 'Back' })
      ).toHaveAttribute('data-active', 'true')
      await userEvent.keyboard('{ArrowDown}{Tab}')

      expect(selectWorkflowReference).toHaveBeenCalledWith(workflow)
      expect(emitted().send).toBeUndefined()
    })

    it('stages an eligible workflow from the Workflows submenu', async () => {
      const workflow = { id: 'wf-water', name: 'Water world' }
      const { selectWorkflowReference } = mount({
        availableWorkflows: [
          { id: 'wf-edit', name: 'Editable workflow' },
          workflow
        ],
        editableWorkflowId: 'wf-edit'
      })

      const menu = await openReferenceSection('Workflows', '@water')
      await userEvent.click(
        within(menu).getByRole('menuitem', { name: 'Water world' })
      )

      expect(selectWorkflowReference).toHaveBeenCalledWith(workflow)
      expect(useAgentComposerStore().draft).toBe(' ')
    })

    it('requests fresh workflow candidates when @ enters Workflows', async () => {
      const { emitted } = mount()

      await openReferenceSection('Workflows')

      expect(emitted().requestWorkflowReferences).toHaveLength(1)
    })

    it('reopens at the root after closing a filtered workflow submenu', async () => {
      const { emitted } = mount({
        getMentionNodes: () => NODES,
        availableWorkflows: [{ id: 'wf-water', name: 'Water world' }]
      })
      await openReferenceSection('Workflows', '@water')
      await userEvent.keyboard('{Escape}')
      expect(screen.queryByRole('menu')).toBeNull()

      await userEvent.clear(screen.getByRole('textbox'))
      await userEvent.type(screen.getByRole('textbox'), '@{Enter}')
      expect(screen.getByRole('menuitem', { name: 'VAE Decode' })).toBeVisible()
      await userEvent.keyboard('{ArrowDown}{Enter}')
      expect(emitted().mentionPick).toEqual([[NODES[0]]])
    })

    it('keeps a failed workflow mention retryable and consumes it only on success', async () => {
      const selectWorkflowReference = vi
        .fn(
          async (): Promise<WorkflowReferenceMetadata | undefined> => ({
            id: 'saved-scratch',
            name: 'Scratch'
          })
        )
        .mockResolvedValueOnce(undefined)
      mount({
        availableWorkflows: [{ tabPath: 'scratch.json', name: 'Scratch' }],
        selectWorkflowReference
      })
      await openReferenceSection('Workflows', '@scratch')
      await userEvent.keyboard('{Enter}')
      expect(useAgentComposerStore().draft).toBe('@scratch')
      expect(
        screen.getByRole('menuitem', { name: /^Scratch\s*Unsaved$/ })
      ).toBeVisible()

      await userEvent.keyboard('{Enter}')
      expect(selectWorkflowReference).toHaveBeenCalledTimes(2)
      expect(useAgentComposerStore().draft).toBe(' ')
      expect(screen.queryByRole('menu')).toBeNull()
    })

    it.for(['', ' after'])(
      'places the caret after one real space following a chip with suffix "%s"',
      async (suffix) => {
        mount({ availableWorkflows: [{ id: 'wf-water', name: 'Water world' }] })
        const textbox = screen.getByRole('textbox')
        await userEvent.type(textbox, `Before @${suffix}`)
        await userEvent.pointer({
          keys: '[MouseLeft]',
          target: textbox,
          offset: 'Before @'.length
        })
        await userEvent.click(
          screen.getByRole('menuitem', { name: 'Workflows' })
        )
        await userEvent.keyboard('{ArrowDown}{Enter}')
        expect(useAgentComposerStore().draft).toBe(
          `Before  ${suffix.trimStart()}`
        )
        await userEvent.keyboard('next ')
        expect(useAgentComposerStore().draft).toBe(
          `Before  next ${suffix.trimStart()}`
        )
        expect(textbox).toHaveTextContent(
          `Before Water world next ${suffix.trimStart()}`.trim()
        )
      }
    )

    it('removes the chosen mention while retaining the text on both sides', async () => {
      const { selectWorkflowReference } = mount({
        availableWorkflows: [{ id: 'wf-water', name: 'Water world' }]
      })
      const textbox = screen.getByRole('textbox')
      await userEvent.type(textbox, 'Compare @ with target')
      await userEvent.pointer({
        keys: '[MouseLeft]',
        target: textbox,
        offset: 'Compare @'.length
      })
      await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))
      await userEvent.keyboard('{ArrowDown}{Enter}')

      expect(selectWorkflowReference).toHaveBeenCalledWith({
        id: 'wf-water',
        name: 'Water world'
      })
      expect(useAgentComposerStore().draft).toBe('Compare  with target')
      expect(textbox).toHaveTextContent('Compare Water world with target')
      expect(screen.queryByRole('menu')).toBeNull()
    })

    it('returns from a reference submenu to the root menu', async () => {
      mount({ getMentionNodes: () => NODES })
      const menu = await openReferenceSection('Nodes')

      await userEvent.click(
        within(menu).getByRole('menuitem', { name: 'Back' })
      )

      const root = screen.getByRole('menu', { name: 'Add to prompt' })
      expect(within(root).getByText('Reference')).toBeVisible()
      expect(
        within(root).getByRole('menuitem', { name: 'Nodes' })
      ).toBeVisible()
      expect(
        within(root).getByRole('menuitem', { name: 'Workflows' })
      ).toBeVisible()
    })

    it('includes selected workflow references in the send snapshot', async () => {
      const references = [
        { id: 'wf-water', name: 'Water world', textOffset: 0 }
      ]
      useAgentComposerStore().setText('use this workflow')
      const { emitted } = mount({ workflowReferences: references })

      await userEvent.click(screen.getByRole('button', { name: 'Send' }))

      expect(emitted().send[0]).toEqual(['use this workflow', [], references])
    })

    it('keeps spaces next to boundary chips when trimming a sent prompt', async () => {
      useAgentComposerStore().setText('  Copy  into  ')
      const { emitted } = mount({
        workflowReferences: [
          { id: 'a', name: 'A', textOffset: 7 },
          { id: 'b', name: 'B', textOffset: 13 }
        ]
      })

      await userEvent.click(screen.getByRole('button', { name: 'Send' }))

      expect(emitted().send[0]).toEqual([
        'Copy  into ',
        [],
        [
          { id: 'a', name: 'A', textOffset: 5 },
          { id: 'b', name: 'B', textOffset: 11 }
        ]
      ])
    })

    it('excludes only the referenced id when node titles match', async () => {
      mount({ selectionTags: [NODES[0]], getMentionNodes: () => NODES })

      const menu = await openReferenceSection('Nodes')

      expect(within(menu).queryByText('#5')).not.toBeInTheDocument()
      expect(within(menu).getByText('#7')).toBeInTheDocument()
      expect(within(menu).getByText('VAE Decode')).toBeInTheDocument()
    })

    it('keeps a duplicate-title id visible when filtering by id', async () => {
      mount({ getMentionNodes: () => NODES })

      const menu = await openReferenceSection('Nodes', '@5')

      expect(within(menu).getAllByRole('menuitem')).toHaveLength(2)
      expect(within(menu).getByText('#5')).toBeInTheDocument()
    })

    it('closes on Escape so Enter sends normally', async () => {
      const { emitted } = mount({ getMentionNodes: () => NODES })
      const box = screen.getByRole('textbox')

      await userEvent.type(box, 'hi @k')
      expect(screen.getByRole('menu')).toBeInTheDocument()

      await userEvent.keyboard('{Escape}')
      expect(screen.queryByRole('menu')).toBeNull()

      await userEvent.keyboard('{Enter}')
      expect(emitted().send[0]).toEqual(['hi @k', []])
    })

    it('ignores an @ inside a word', async () => {
      mount({ getMentionNodes: () => NODES })

      await userEvent.type(screen.getByRole('textbox'), 'email@k')
      expect(screen.queryByRole('menu')).toBeNull()
    })

    it('lets Shift+Enter insert a newline instead of picking', async () => {
      const { emitted } = mount({ getMentionNodes: () => NODES })
      const box = screen.getByRole('textbox')

      await userEvent.type(box, '@k')
      expect(screen.getByRole('menu')).toBeInTheDocument()

      await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
      expect(emitted().mentionPick).toBeUndefined()
      expect(emitted().send).toBeUndefined()
      expect(useAgentComposerStore().draft).toBe('@k\n')
      expect(screen.queryByRole('menu')).toBeNull()
    })

    it('closes when the caret moves out of the token', async () => {
      mount({ getMentionNodes: () => NODES })
      const box = screen.getByRole('textbox')

      await userEvent.type(box, '@k')
      expect(screen.getByRole('menu')).toBeInTheDocument()

      await userEvent.keyboard('{Home}')
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    })
  })

  it('restores the typed draft after unmount and remount', async () => {
    const first = mount()
    await userEvent.type(screen.getByRole('textbox'), 'keep me')
    first.unmount()

    mount()
    expect(useAgentComposerStore().draft).toBe('keep me')
  })

  async function openAddMenu() {
    await userEvent.click(screen.getByRole('button', { name: 'Add to prompt' }))
    // Anchor on the entry that is always present, so the absence assertions
    // below cannot pass against a menu that never opened.
    return screen.findByRole('menuitem', { name: 'Nodes' })
  }

  it('separates node and workflow references in the add menu', async () => {
    mount()

    await openAddMenu()

    expect(screen.getByRole('menuitem', { name: 'Nodes' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Workflows' })).toBeVisible()
  })

  it('returns from the workflow submenu to the reference menu', async () => {
    mount()

    await openAddMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Back' }))

    expect(screen.getByRole('menuitem', { name: 'Nodes' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Workflows' })).toBeVisible()
  })

  it('requests fresh workflow candidates when + opens Workflows', async () => {
    const { emitted } = mount()

    await openAddMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))

    expect(emitted().requestWorkflowReferences).toHaveLength(1)
  })

  it('lists only eligible workflows and selects the chosen reference', async () => {
    const { selectWorkflowReference } = mount({
      availableWorkflows: [
        { id: 'wf-edit', name: 'Editable workflow' },
        { id: 'wf-selected', name: 'Already selected' },
        { id: 'wf-eligible', name: 'Water world' }
      ],
      workflowReferences: [
        { id: 'wf-selected', name: 'Already selected', textOffset: 0 }
      ],
      editableWorkflowId: 'wf-edit'
    })

    await openAddMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))

    expect(
      screen.queryByRole('menuitem', { name: 'Editable workflow' })
    ).toBeNull()
    expect(
      screen.queryByRole('menuitem', { name: 'Already selected' })
    ).toBeNull()
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Water world' })
    )

    expect(selectWorkflowReference.mock.calls).toEqual([
      [{ id: 'wf-eligible', name: 'Water world' }]
    ])
  })

  it('preserves typing done while a reference selection is saving', async () => {
    let resolve: (
      saved: WorkflowReferenceMetadata | undefined
    ) => void = () => {}
    const promise = new Promise<WorkflowReferenceMetadata | undefined>(
      (done) => {
        resolve = done
      }
    )
    mount({
      availableWorkflows: [{ tabPath: 'scratch.json', name: 'Scratch' }],
      selectWorkflowReference: () => promise
    })
    const textbox = screen.getByRole('textbox')
    await userEvent.type(textbox, 'Compare @')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))
    await userEvent.click(
      screen.getByRole('menuitem', { name: /^Scratch\s*Unsaved$/ })
    )
    await userEvent.type(textbox, ' more detail')
    resolve({ id: 'saved-scratch', name: 'Scratch' })
    await promise
    await nextTick()
    expect(useAgentComposerStore().draft).toBe('Compare  more detail')
    expect(textbox).toHaveTextContent('Compare Scratch more detail')
  })

  it.for(['pointer', 'Enter', 'Space'])(
    'opens a staged workflow with %s without consuming the draft',
    async (interaction) => {
      const { emitted } = mount({
        workflowReferences: [
          { id: 'wf-1', name: 'Water world', textOffset: 0 }
        ],
        selectionTags: [{ id: '5', title: 'KSampler' }]
      })
      const textarea = screen.getByRole('textbox')
      await userEvent.type(textarea, 'Keep this prompt')
      const chip = screen.getByRole('button', { name: 'Open Water world' })
      if (interaction === 'pointer') await userEvent.click(chip)
      else {
        chip.focus()
        await userEvent.keyboard(interaction === 'Enter' ? '{Enter}' : ' ')
      }

      expect(emitted().openReferenceWorkflow).toEqual([['wf-1', 'Water world']])
      expect(emitted().removeWorkflowReference).toBeUndefined()
      expect(emitted().send).toBeUndefined()
      expect(useAgentComposerStore().draft).toBe('Keep this prompt')
      expect(screen.getByTestId('composer-node-section')).toHaveTextContent(
        'KSampler'
      )
    }
  )

  it('preserves unavailable references while editing and permits their removal', async () => {
    const { emitted } = mount({
      workflowReferences: [
        { id: 'missing', name: 'Missing', textOffset: 0, unavailable: true }
      ]
    })
    await userEvent.type(screen.getByRole('textbox'), 'Keep this prompt')
    const chip = screen.getByRole('button', { name: 'Missing (unavailable)' })
    expect(chip).toHaveAttribute('aria-disabled', 'true')
    expect(chip).toHaveAttribute(
      'aria-description',
      i18n.global.t('agent.workflowReferenceUnavailableReason')
    )
    await userEvent.click(chip)
    await userEvent.keyboard('{Enter} ')
    expect(emitted().openReferenceWorkflow).toBeUndefined()
    expect(useAgentComposerStore().workflowReferences).toEqual([
      { id: 'missing', name: 'Missing', textOffset: 16, unavailable: true }
    ])
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Missing reference' })
    )
    expect(useAgentComposerStore().workflowReferences).toEqual([])
    expect(useAgentComposerStore().draft).toBe('Keep this prompt')
  })

  it.for(['pointer', 'keyboard'])(
    'removes only the chosen workflow with %s without navigating',
    async (interaction) => {
      const { emitted } = mount({
        workflowReferences: [
          { id: 'wf-1', name: 'Water world', textOffset: 0 },
          { id: 'wf-2', name: 'Portrait lighting', textOffset: 0 }
        ]
      })
      const textarea = screen.getByRole('textbox')
      await userEvent.type(textarea, 'Keep this prompt')
      const remove = screen.getByRole('button', {
        name: 'Remove Water world reference'
      })
      if (interaction === 'pointer') await userEvent.click(remove)
      else {
        remove.focus()
        await userEvent.keyboard(' ')
      }

      expect(emitted().removeWorkflowReference).toEqual([['wf-1']])
      expect(emitted().openReferenceWorkflow).toBeUndefined()
      expect(emitted().send).toBeUndefined()
      expect(useAgentComposerStore().draft).toBe('Keep this prompt')
    }
  )

  it('removes the workflow reference before the text caret with Backspace', async () => {
    useAgentComposerStore().setText('keep me')
    const { emitted } = mount({
      workflowReferences: [
        { id: 'wf-1', name: 'Water world', textOffset: 0 },
        { id: 'wf-2', name: 'Portrait lighting', textOffset: 0 }
      ]
    })

    const inlineInput = screen.getByTestId('composer-inline-input')
    const workflowChips = within(inlineInput).getAllByTestId(
      'workflow-reference-chip'
    )
    expect(workflowChips).toHaveLength(2)
    expect(inlineInput).toContainElement(screen.getByRole('textbox'))

    const textbox = screen.getByRole('textbox')
    await userEvent.click(textbox)
    const caret = document.createRange()
    caret.setStartAfter(workflowChips[1])
    caret.collapse(true)
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(caret)
    await userEvent.keyboard('{Backspace}')

    expect(emitted().removeWorkflowReference).toEqual([['wf-2']])
    expect(useAgentComposerStore().draft).toBe('keep me')
  })

  it('keeps normal text deletion when the caret is not at the start', async () => {
    const { emitted } = mount({
      workflowReferences: [{ id: 'wf-1', name: 'Water world', textOffset: 0 }]
    })

    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'text')
    await userEvent.keyboard('{Backspace}')

    expect(emitted().removeWorkflowReference).toBeUndefined()
    expect(useAgentComposerStore().draft).toBe('tex')
  })

  it('keeps selected nodes in a dedicated section above the inline prompt', () => {
    mount({
      selectionTags: [{ id: '5', title: 'KSampler' }],
      workflowReferences: [{ id: 'wf-1', name: 'Water world', textOffset: 0 }]
    })

    const nodeSection = screen.getByTestId('composer-node-section')
    const inlineInput = screen.getByTestId('composer-inline-input')

    expect(nodeSection).toHaveClass('border-b', 'p-3')
    expect(nodeSection).toHaveTextContent('KSampler')
    expect(nodeSection).not.toContainElement(screen.getByRole('textbox'))
    expect(inlineInput).not.toHaveTextContent('KSampler')
    expect(inlineInput).toHaveTextContent('Water world')
  })

  it('keeps added assets in a separate padded section above the prompt', async () => {
    const composer = ref<InstanceType<typeof Composer> | null>(null)
    const Host = defineComponent({
      setup: () => () => h(Composer, { ref: composer })
    })
    render(Host, { global: { plugins: [i18n] } })
    composer.value?.addAttachment({
      id: 'attachment-1',
      name: 'cat.png',
      ref: 'uploaded_cat.png',
      previewUrl: 'https://example.com/cat.png'
    })
    await nextTick()

    const assetSection = screen.getByTestId('composer-asset-section')
    const inlineInput = screen.getByTestId('composer-inline-input')

    expect(assetSection).toHaveClass('p-3')
    expect(assetSection).toContainElement(
      screen.getByRole('img', { name: 'cat.png' })
    )
    expect(inlineInput).not.toContainElement(
      screen.getByRole('img', { name: 'cat.png' })
    )
  })

  it('keeps uploaded attachments when navigating from a staged workflow', async () => {
    useAgentComposerStore().setWorkflowReferences([
      { id: 'wf-1', name: 'Water world', textOffset: 0 }
    ])
    const composer = ref<InstanceType<typeof Composer> | null>(null)
    const onOpenReferenceWorkflow = vi.fn()
    const Host = defineComponent({
      setup: () => () =>
        h(Composer, {
          ref: composer,
          onOpenReferenceWorkflow
        })
    })
    render(Host, { global: { plugins: [i18n] } })
    composer.value?.addAttachment({
      id: 'attachment-1',
      name: 'cat.png',
      ref: 'uploaded_cat.png'
    })
    await nextTick()
    await userEvent.click(
      screen.getByRole('button', { name: 'Open Water world' })
    )
    expect(onOpenReferenceWorkflow).toHaveBeenCalledWith('wf-1', 'Water world')
    expect(screen.getByTestId('composer-asset-section')).toHaveTextContent(
      'cat.png'
    )
  })

  it('keeps the empty prompt hint visible when only nodes are selected', () => {
    mount({ selectionTags: [{ id: '5', title: 'KSampler' }] })

    expect(
      screen.getByText(
        'Describe ideas, @ to reference workflows, drag in media asset and files, or'
      )
    ).toBeVisible()
  })

  it('hides the conditional entries from the add menu by default', async () => {
    mount()

    await openAddMenu()

    expect(
      screen.queryByRole('menuitem', { name: 'Upload images or files' })
    ).toBeNull()
    expect(
      screen.queryByRole('menuitem', { name: 'Drag in asset from asset panel' })
    ).toBeNull()
  })

  it('emits attach from the add menu when canAttach is set', async () => {
    const { emitted } = mount({ canAttach: true })

    await openAddMenu()
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Upload images or files' })
    )

    expect(emitted().attach).toHaveLength(1)
  })

  it('emits openAssets from the add menu when canOpenAssets is set', async () => {
    const { emitted } = mount({ canOpenAssets: true })

    await openAddMenu()
    await userEvent.click(
      await screen.findByRole('menuitem', {
        name: 'Drag in asset from asset panel'
      })
    )

    expect(emitted().openAssets).toHaveLength(1)
  })

  it('enters graph selection mode without querying the mention picker', async () => {
    const getMentionNodes = vi.fn(() => [])
    const { emitted } = mount({ getMentionNodes })

    await userEvent.click(await openAddMenu())

    expect(emitted().selectNodes).toHaveLength(1)
    expect(getMentionNodes).not.toHaveBeenCalled()
  })

  it('hides the id on a uniquely named selection chip', () => {
    mount({ selectionTags: [{ id: '5', title: 'KSampler' }] })

    expect(screen.getByText('KSampler')).toBeInTheDocument()
    expect(screen.queryByText('#5')).not.toBeInTheDocument()
  })

  it('emits removeTag when a selection chip is removed', async () => {
    const { emitted } = mount({
      selectionTags: [{ id: '5', title: 'KSampler' }]
    })

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove KSampler #5 reference' })
    )

    expect(emitted().removeTag).toEqual([['5']])
  })

  it('builds the remove tooltip for a selection chip', () => {
    mount({ selectionTags: [{ id: '5', title: 'KSampler' }] })

    const removeButton = screen.getByRole('button', {
      name: 'Remove KSampler #5 reference'
    })
    expect(tooltipBindings.get(removeButton)).toEqual(
      tooltipConfig.buildAgentTooltipConfig('Remove')
    )
  })

  it('renders a selection chip label as non-interactive context', () => {
    mount({ selectionTags: [{ id: '5', title: 'KSampler' }] })

    expect(screen.getByText('KSampler')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Show KSampler #5 on canvas' })
    ).toBeNull()
  })

  // The remove button sits outside the focus trigger; removing a chip must not
  // also fly the canvas to the node being removed.
  it('removes a selection chip without focusing its node', async () => {
    const { emitted } = mount({
      selectionTags: [{ id: '5', title: 'KSampler' }]
    })

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove KSampler #5 reference' })
    )

    expect(emitted().removeTag).toEqual([['5']])
    expect(emitted().focusTag).toBeUndefined()
  })

  it('shows the id on a lone selection chip with a graph title twin', () => {
    const selected = { id: '5', title: 'KSampler' }
    mount({
      selectionTags: [selected],
      getMentionNodes: () => [selected, { id: '7', title: 'KSampler' }]
    })

    expect(screen.getByText('KSampler')).toBeInTheDocument()
    expect(screen.getByText('#5')).toBeInTheDocument()
    expect(screen.queryByText('#7')).not.toBeInTheDocument()
  })

  it('shows ids when selection chips have duplicate titles', () => {
    mount({
      selectionTags: [
        { id: '5', title: 'KSampler' },
        { id: '7', title: 'KSampler' }
      ]
    })

    expect(screen.getAllByText('KSampler')).toHaveLength(2)
    expect(screen.getByText('#5')).toBeInTheDocument()
    expect(screen.getByText('#7')).toBeInTheDocument()
  })

  it('renders an attachment preview and removes it from the composer', async () => {
    const composer = ref<InstanceType<typeof Composer> | null>(null)
    const Host = defineComponent({
      setup: () => () => h(Composer, { ref: composer })
    })
    render(Host, { global: { plugins: [i18n] } })
    composer.value?.addAttachment({
      id: 'attachment-1',
      name: 'cat.png',
      ref: 'uploaded_cat.png',
      previewUrl: 'https://example.com/cat.png'
    })
    await nextTick()

    expect(screen.getByRole('img', { name: 'cat.png' })).toHaveAttribute(
      'src',
      'https://example.com/cat.png'
    )

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.queryByRole('img', { name: 'cat.png' })).toBeNull()
  })

  describe('insert', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    function mountWithInsert() {
      const composer = ref<InstanceType<typeof Composer> | null>(null)
      const Host = defineComponent({
        setup: () => () => h(Composer, { ref: composer })
      })
      render(Host, { global: { plugins: [i18n] } })
      return {
        insert: (text: string) => composer.value?.insert(text)
      }
    }

    it('inserts text and focuses immediately', async () => {
      const { insert } = mountWithInsert()
      const textarea = screen.getByRole('textbox')
      const focusSpy = vi.spyOn(textarea, 'focus')

      insert('foo')
      await nextTick()

      expect(useAgentComposerStore().draft).toBe('foo')
      expect(textarea).toHaveFocus()
      expect(focusSpy).toHaveBeenCalledOnce()
    })
  })
})
