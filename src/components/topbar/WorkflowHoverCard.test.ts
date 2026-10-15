import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, h, markRaw, ref } from 'vue'

import { i18n } from '@/i18n'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { createGraphThumbnail } from '@/renderer/core/thumbnail/graphThumbnailRenderer'
import { useWorkflowThumbnail } from '@/renderer/core/thumbnail/useWorkflowThumbnail'
import type { AgentTabChat } from '@/stores/workflowTabActivityStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

import WorkflowHoverCard from './WorkflowHoverCard.vue'

vi.mock(import('@/renderer/core/thumbnail/graphThumbnailRenderer'), () => ({
  createGraphThumbnail: vi.fn()
}))

const OPEN_DELAY_MS = 200
const CLOSE_DELAY_MS = 150

function makeWorkflow(
  name: string,
  overrides: Partial<ComfyWorkflow> = {}
): ComfyWorkflow {
  return markRaw(
    fromPartial<ComfyWorkflow>({
      path: `workflows/${name}.json`,
      key: `${name}.json`,
      filename: name,
      isPersisted: true,
      ...overrides
    })
  )
}

function chat(name: string): AgentTabChat {
  return { id: `th-${name}`, title: `${name} chat`, updatedAt: Date.now() }
}

function renderMenus(workflowNames = ['portrait']) {
  useWorkflowTabActivityStore().setAgentChats(
    new Map(
      workflowNames.map((name) => [`workflows/${name}.json`, [chat(name)]])
    ),
    vi.fn()
  )
  render(
    defineComponent(() => () => [
      h('input', { 'aria-label': 'Search' }),
      ...workflowNames.map((name) =>
        h(WorkflowHoverCard, { workflow: makeWorkflow(name) })
      )
    ]),
    { global: { plugins: [i18n] } }
  )
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

function renderAnchoredCard(
  workflow: ComfyWorkflow,
  {
    chats = [],
    agentEnabled = true
  }: { chats?: AgentTabChat[]; agentEnabled?: boolean } = {}
) {
  useWorkflowTabActivityStore().setAgentChats(
    new Map(chats.length ? [[workflow.path, chats]] : []),
    agentEnabled ? vi.fn() : null
  )
  render(
    defineComponent(() => {
      const area = ref<HTMLElement | null>(null)
      return () =>
        h('div', { ref: area }, [
          h('span', `Tab ${workflow.filename}`),
          h(WorkflowHoverCard, { workflow, anchor: area.value })
        ])
    }),
    { global: { plugins: [i18n] } }
  )
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  return {
    user,
    async openCard() {
      await user.hover(screen.getByText(`Tab ${workflow.filename}`))
      await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)
      return screen.getByRole('menu')
    }
  }
}

function chatsButton(workflowName = 'portrait') {
  return screen.getByRole('button', { name: `1 chat on ${workflowName}` })
}

describe('WorkflowHoverCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
  })

  it('opens on a resting hover without taking focus, but not on a pass-over', async () => {
    const user = renderMenus()
    const search = screen.getByRole('textbox', { name: 'Search' })
    await user.click(search)

    await user.hover(chatsButton())
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS - 1)
    await user.unhover(chatsButton())
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)
    expect(screen.queryByRole('menu')).toBeNull()

    await user.hover(chatsButton())
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)

    expect(
      screen.getByRole('menuitem', { name: /^portrait chat/ })
    ).toBeVisible()
    expect(search).toHaveFocus()
  })

  it('stays open while the pointer is in the card and closes once it leaves', async () => {
    const user = renderMenus()
    await user.hover(chatsButton())
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)

    await user.hover(screen.getByRole('menu'))
    await vi.advanceTimersByTimeAsync(CLOSE_DELAY_MS * 2)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.unhover(screen.getByRole('menu'))
    await vi.advanceTimersByTimeAsync(CLOSE_DELAY_MS - 1)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('keeps a hover-opened card open when its indicator is clicked', async () => {
    const user = renderMenus()
    await user.hover(chatsButton())
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)

    await user.click(chatsButton())
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.click(chatsButton())
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('opens from a long tap and stays open after the finger lifts', async () => {
    const user = renderMenus()

    await user.pointer({ keys: '[TouchA>]', target: chatsButton() })
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS * 2)
    await user.pointer({ keys: '[/TouchA]' })
    await vi.advanceTimersByTimeAsync(CLOSE_DELAY_MS * 2)

    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('opens from the keyboard with focus in its chats and returns focus to its indicator on Escape', async () => {
    const user = renderMenus()
    chatsButton().focus()

    await user.keyboard('{Enter}')
    expect(
      screen.getByRole('menuitem', { name: /^portrait chat/ })
    ).toHaveFocus()

    await user.keyboard('{Escape}')
    await vi.runOnlyPendingTimersAsync()

    expect(screen.queryByRole('menu')).toBeNull()
    expect(chatsButton()).toHaveFocus()
    await vi.runOnlyPendingTimersAsync()
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('marks the panel’s current chat in its place and closes when it is picked', async () => {
    const open = vi.fn()
    useWorkflowTabActivityStore().setAgentChats(
      new Map([
        [
          'workflows/portrait.json',
          [
            {
              id: 'th-newer',
              title: 'Newer chat',
              updatedAt: Date.now(),
              current: false
            },
            {
              id: 'th-current',
              title: 'Open chat',
              updatedAt: Date.now() - 3_600_000,
              current: true
            }
          ]
        ]
      ]),
      open
    )
    render(WorkflowHoverCard, {
      props: { workflow: makeWorkflow('portrait') },
      global: { plugins: [i18n] }
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    await user.click(
      screen.getByRole('button', { name: '2 chats on portrait' })
    )

    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent)
    ).toEqual([
      'Newer chatnow',
      'Open chatCurrent · 1h ago',
      'New chat on this workflow'
    ])
    const current = screen.getByRole('menuitem', { name: 'Open chat' })
    expect(current).toHaveAccessibleDescription('Current · 1h ago')
    expect(
      screen.getByRole('menuitem', { name: 'Newer chat' })
    ).toHaveAccessibleDescription('now')

    await user.click(current)

    expect(open).toHaveBeenCalledExactlyOnceWith(
      'workflows/portrait.json',
      'th-current'
    )
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('keeps only one card open at a time', async () => {
    const user = renderMenus(['portrait', 'archive'])
    chatsButton('portrait').focus()
    await user.keyboard('{Enter}')

    await user.hover(chatsButton('archive'))
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)

    expect(
      screen.queryByRole('menuitem', { name: /^portrait chat/ })
    ).toBeNull()
    expect(
      screen.getByRole('menuitem', { name: /^archive chat/ })
    ).toBeVisible()
  })

  describe('contents', () => {
    beforeEach(() => {
      onTestFinished(() => useWorkflowThumbnail().clearAllThumbnails())
    })

    it.for([
      {
        when: 'a saved workflow for an agent user',
        workflow: makeWorkflow('portrait'),
        chats: [chat('portrait')],
        agentEnabled: true,
        items: ['portrait chatnow', 'New chat on this workflow']
      },
      {
        when: 'a saved workflow without chats for an agent user',
        workflow: makeWorkflow('portrait'),
        chats: [],
        agentEnabled: true,
        items: ['New chat on this workflow']
      },
      {
        when: 'an unsaved workflow',
        workflow: makeWorkflow('Unsaved Workflow', { isPersisted: false }),
        chats: [],
        agentEnabled: true,
        items: []
      },
      {
        when: 'a user who cannot use the agent',
        workflow: makeWorkflow('portrait'),
        chats: [],
        agentEnabled: false,
        items: []
      }
    ])(
      'shows the name and offers $items.length chat options for $when',
      async ({ workflow, chats, agentEnabled, items }) => {
        const { openCard } = renderAnchoredCard(workflow, {
          chats,
          agentEnabled
        })

        const card = await openCard()

        expect(within(card).getByText(workflow.filename)).toBeVisible()
        expect(
          within(card)
            .queryAllByRole('menuitem')
            .map((item) => item.textContent)
        ).toEqual(items)
      }
    )

    it.for([
      { when: 'was captured', stored: 'data:image/png;base64,stored' },
      { when: 'was never captured', stored: undefined }
    ])(
      'shows a background workflow’s preview only if one $when',
      async ({ stored }) => {
        const workflow = makeWorkflow('portrait')
        if (stored)
          useWorkflowThumbnail().workflowThumbnails.value.set(
            workflow.key,
            stored
          )
        const { openCard } = renderAnchoredCard(workflow)

        const card = await openCard()

        expect(
          within(card)
            .queryByRole('img', { name: 'Preview of portrait' })
            ?.getAttribute('src')
        ).toBe(stored)
        expect(createGraphThumbnail).not.toHaveBeenCalled()
      }
    )

    it.for([
      { when: 'has nodes', rendered: 'data:image/png;base64,live' },
      { when: 'is empty', rendered: null }
    ])(
      'renders the active workflow’s preview fresh when it opens, if its graph $when',
      async ({ rendered }) => {
        const workflow = makeWorkflow('portrait')
        useWorkflowStore().activeWorkflow = fromPartial({
          path: workflow.path
        })
        const liveGraph = fromPartial<LGraph>({})
        useCanvasStore().currentGraph = liveGraph
        useWorkflowThumbnail().workflowThumbnails.value.set(
          workflow.key,
          'data:image/png;base64,stale'
        )
        vi.mocked(createGraphThumbnail).mockReturnValue(rendered)
        const { openCard } = renderAnchoredCard(workflow)

        const card = await openCard()

        expect(createGraphThumbnail).toHaveBeenCalledExactlyOnceWith(liveGraph)
        expect(
          within(card)
            .queryByRole('img', { name: 'Preview of portrait' })
            ?.getAttribute('src')
        ).toBe(rendered ?? undefined)
      }
    )
  })
})
