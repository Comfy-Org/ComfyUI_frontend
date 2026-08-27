import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { DirectiveBinding } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import * as tooltipConfig from '@/composables/useTooltipConfig'
import { i18n } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAgentRunModeStore } from '../../stores/agent/agentRunModeStore'
import Composer from './Composer.vue'

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
vi.mock('@/scripts/api', () => ({ api: { fetchApi } }))

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function mount(
  props: ComponentProps<typeof Composer> = {},
  attrs: Record<string, unknown> = {}
) {
  return render(Composer, {
    props,
    attrs,
    global: {
      plugins: [i18n],
      directives: { tooltip: tooltipDirectiveStub }
    }
  })
}

describe('Composer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('T-21 / PM-678 / FE-1325 hints at ideas, canvas references, and dragged assets', () => {
    mount()

    expect(screen.getByText('Describe ideas, @ to reference,')).toBeVisible()
    const addNodes = screen.getByRole('button', {
      name: 'add nodes from graph,'
    })
    expect(addNodes).toBeVisible()
    expect(addNodes).toContainHTML(
      '<span class="icon-[lucide--mouse-pointer-click] size-[14px] shrink-0"></span>'
    )
    expect(screen.getByText('or drag in assets')).toBeVisible()
  })

  it('hides the empty-composer hint once typing begins', async () => {
    mount()
    const box = screen.getByRole('textbox')

    await userEvent.type(box, 'hello')

    expect((box as HTMLTextAreaElement).value).toBe('hello')
    expect(
      screen.queryByRole('button', { name: 'add nodes from graph,' })
    ).toBeNull()
  })

  it('enters graph selection mode from the empty-composer hint', async () => {
    const getMentionNodes = vi.fn(() => [])
    const { emitted } = mount({ getMentionNodes })
    const hintButton = screen.getByRole('button', {
      name: 'add nodes from graph,'
    })

    await userEvent.tab()
    await userEvent.tab()
    expect(hintButton).toHaveFocus()
    await userEvent.keyboard('{Enter}')

    expect(emitted().selectNodes).toHaveLength(1)
    expect(getMentionNodes).not.toHaveBeenCalled()
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
    await screen.findByRole('menuitem', { name: 'Attach images or files' })

    // Unescaped syntax characters (@, |, {) in a locale message compile to an
    // error and silently fall back to the raw string.
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain(
      'Message compilation error'
    )

    consoleError.mockRestore()
  })

  it('emits send with the trimmed text and clears the draft', async () => {
    const { emitted } = mount()
    const box = screen.getByRole('textbox')
    await userEvent.type(box, '  make art  ')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(emitted().send[0]).toEqual(['make art', []])
    expect((box as HTMLTextAreaElement).value).toBe('')
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
    })

    it('saves a new run mode with its credit limit and closes', async () => {
      mount()
      const store = useAgentRunModeStore()

      await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
      await userEvent.click(
        await screen.findByRole('radio', { name: /Auto-run with limits/ })
      )
      const save = screen.getByRole('button', { name: 'Save changes' })
      expect(save).toBeEnabled()
      const input = screen.getByRole('spinbutton', { name: 'credits' })
      expect(input).toHaveValue(300)
      await userEvent.clear(input)
      await userEvent.type(input, '500')
      expect(save).toBeEnabled()
      await userEvent.click(save)

      expect(
        screen.queryByText('Choose when the agent needs your consent')
      ).toBeNull()
      expect(
        await screen.findByRole('button', { name: 'Auto (limited)' })
      ).toBeInTheDocument()
      expect(store.mode).toBe('auto_limited')
      expect(store.creditLimit).toBe(500)
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

    it('keeps Save disabled while the limit draft is invalid', async () => {
      mount()
      const store = useAgentRunModeStore()
      await store.save('auto_limited', 450)

      await userEvent.click(
        await screen.findByRole('button', { name: 'Auto (limited)' })
      )
      const input = await screen.findByRole('spinbutton', { name: 'credits' })
      await userEvent.clear(input)

      expect(
        screen.getByRole('button', { name: 'Save changes' })
      ).toBeDisabled()

      await userEvent.type(input, '1.5')
      expect(
        screen.getByRole('button', { name: 'Save changes' })
      ).toBeDisabled()
    })

    it('enables Save when only the credit limit changes', async () => {
      mount()
      const store = useAgentRunModeStore()
      await store.save('auto_limited', 450)

      await userEvent.click(
        await screen.findByRole('button', { name: 'Auto (limited)' })
      )
      const save = await screen.findByRole('button', { name: 'Save changes' })
      expect(save).toBeDisabled()

      const input = screen.getByRole('spinbutton', { name: 'credits' })
      await userEvent.clear(input)
      await userEvent.type(input, '460')
      expect(save).toBeEnabled()

      await userEvent.click(save)
      await vi.waitFor(() => expect(store.creditLimit).toBe(460))
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
      const menu = await openReferenceRoot(text)
      await userEvent.click(
        within(menu).getByRole('menuitem', { name: section })
      )
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
          .map((item) => item.textContent?.trim())
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
          .map((item) => item.textContent?.trim())
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
        .map((item) => item.textContent?.trim())
      expect(labels).not.toContain(NODES[0].title)
      expect(labels).toEqual(['Back', 'KSampler#7', 'VAE Decode'])
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
      const box = screen.getByRole('textbox')

      const menu = await openReferenceSection('Nodes', '@vae de')
      expect(within(menu).getAllByRole('menuitem')).toHaveLength(2)
      expect(within(menu).getByText('VAE Decode')).toBeVisible()

      await userEvent.keyboard('{ArrowDown}{Enter}')
      expect(emitted().mentionPick[0]).toEqual([NODES[2]])
      expect(emitted().send).toBeUndefined()
      expect((box as HTMLTextAreaElement).value).toBe('')
    })

    it('navigates categories and submenu items with the keyboard', async () => {
      const workflow = { id: 'wf-water', name: 'Water world' }
      const { emitted } = mount({ availableWorkflows: [workflow] })

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

      expect(emitted().workflowReferencePick).toEqual([[workflow]])
      expect(emitted().send).toBeUndefined()
    })

    it('stages an eligible workflow from the Workflows submenu', async () => {
      const workflow = { id: 'wf-water', name: 'Water world' }
      const { emitted } = mount({
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

      expect(emitted().workflowReferencePick).toEqual([[workflow]])
      expect(screen.getByRole('textbox')).toHaveValue('')
    })

    it('returns from a reference submenu to the root menu', async () => {
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
      const references = [{ id: 'wf-water', name: 'Water world' }]
      const { emitted } = mount({ workflowReferences: references })

      await userEvent.type(screen.getByRole('textbox'), 'use this workflow')
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))

      expect(emitted().send[0]).toEqual(['use this workflow', [], references])
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
      expect((box as HTMLTextAreaElement).value).toBe('@k\n')
      expect(screen.queryByRole('menu')).toBeNull()
    })

    it('closes when the caret moves out of the token', async () => {
      mount({ getMentionNodes: () => NODES })
      const box = screen.getByRole('textbox')

      await userEvent.type(box, '@k')
      expect(screen.getByRole('menu')).toBeInTheDocument()

      await userEvent.keyboard('{Home}')
      expect(screen.queryByRole('menu')).toBeNull()
    })
  })

  it('restores the typed draft after unmount and remount', async () => {
    const first = mount()
    await userEvent.type(screen.getByRole('textbox'), 'keep me')
    first.unmount()

    mount()
    expect(screen.getByRole<HTMLTextAreaElement>('textbox').value).toBe(
      'keep me'
    )
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

  it('lists only eligible workflows and emits the selected reference', async () => {
    const { emitted } = mount(
      {},
      {
        availableWorkflows: [
          { id: 'wf-edit', name: 'Editable workflow' },
          { id: 'wf-selected', name: 'Already selected' },
          { id: 'wf-eligible', name: 'Water world' }
        ],
        workflowReferences: [{ id: 'wf-selected', name: 'Already selected' }],
        editableWorkflowId: 'wf-edit'
      }
    )

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

    expect(emitted().workflowReferencePick).toEqual([
      [{ id: 'wf-eligible', name: 'Water world' }]
    ])
  })

  it('renders and removes a selected workflow reference chip', async () => {
    const { emitted } = mount(
      {},
      {
        workflowReferences: [{ id: 'wf-1', name: 'Water world' }]
      }
    )

    const inlineInput = screen.getByTestId('composer-inline-input')
    const workflowChip = within(inlineInput).getByTestId(
      'workflow-reference-chip'
    )
    expect(workflowChip).toHaveClass(
      'bg-primary-background/30',
      'border-primary-background/30',
      'text-primary-background-hover',
      'rounded-sm'
    )
    expect(inlineInput).toContainElement(screen.getByRole('textbox'))
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Water world reference' })
    )

    expect(emitted().removeWorkflowReference).toEqual([['wf-1']])
  })

  it('hides the conditional entries from the add menu by default', async () => {
    mount()

    await openAddMenu()

    expect(
      screen.queryByRole('menuitem', { name: 'Attach images or files' })
    ).toBeNull()
    expect(
      screen.queryByRole('menuitem', { name: 'Add from assets panel' })
    ).toBeNull()
  })

  it('emits attach from the add menu when canAttach is set', async () => {
    const { emitted } = mount({ canAttach: true })

    await openAddMenu()
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Attach images or files' })
    )

    expect(emitted().attach).toHaveLength(1)
  })

  it('emits openAssets from the add menu when canOpenAssets is set', async () => {
    const { emitted } = mount({ canOpenAssets: true })

    await openAddMenu()
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Add from assets panel' })
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

  it('passes the full tooltip config to selection chip directives', () => {
    mount({ selectionTags: [{ id: '5', title: 'KSampler' }] })

    const button = screen.getByRole('button', {
      name: 'Show KSampler #5 on canvas'
    })
    expect(tooltipBindings.get(button)).toEqual(
      tooltipConfig.buildAgentTooltipConfig('Show on canvas')
    )
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

  it('emits focusTag when a selection chip is activated', async () => {
    const { emitted } = mount({
      selectionTags: [{ id: '5', title: 'KSampler' }]
    })

    await userEvent.click(
      screen.getByRole('button', { name: 'Show KSampler #5 on canvas' })
    )

    expect(emitted().focusTag).toEqual([['5']])
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

    it('inserts text and focuses without scheduling delayed UI state', async () => {
      const { insert } = mountWithInsert()
      const textarea = screen.getByRole('textbox')
      const focusSpy = vi.spyOn(textarea, 'focus')

      insert('foo')
      await nextTick()

      expect(textarea).toHaveValue('foo')
      expect(textarea).toHaveFocus()
      expect(focusSpy).toHaveBeenCalledOnce()
      expect(vi.getTimerCount()).toBe(0)
    })
  })
})
