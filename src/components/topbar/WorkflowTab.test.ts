import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { TabsList, TabsRoot } from 'reka-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, markRaw, nextTick } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useExecutionStore } from '@/stores/executionStore'
import type { WorkflowExecutionStatus } from '@/stores/executionStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

import WorkflowTab from './WorkflowTab.vue'
vi.mock(import('firebase/auth'))

vi.mock(import('@/composables/usePragmaticDragAndDrop'), () => ({
  usePragmaticDraggable: vi.fn(),
  usePragmaticDroppable: vi.fn()
}))

vi.mock<unknown>(import('@/composables/useWorkflowActionsMenu'), () => ({
  useWorkflowActionsMenu: () => ({
    menuItems: { value: [] }
  })
}))

vi.mock(import('@/platform/workflow/core/services/workflowService'))

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

type WorkflowTabProps = ComponentProps<typeof WorkflowTab>

const statusAriaLabels: Record<WorkflowExecutionStatus, string> = {
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed'
}

const agentAriaLabels = {
  agentWorking: 'Agent is working on this workflow',
  agentModified: 'Agent updated this workflow'
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        close: 'Close',
        ...statusAriaLabels,
        ...agentAriaLabels,
        relativeTime: {
          now: 'now',
          hoursAgo: '{count}h ago',
          daysAgo: '{count}d ago'
        }
      },
      agent: {
        targetForThisChat: 'Agent target for this chat',
        workflowChatsCount:
          '{count} chat on {workflowName} | {count} chats on {workflowName}',
        newChatOnWorkflow: 'New chat on this workflow'
      },
      sideToolbar: {
        workflowTab: { workflowPreview: 'Preview of {workflowName}' }
      }
    }
  }
})

type WorkflowOption = WorkflowTabProps['workflowOption']
type Workflow = WorkflowOption['workflow']
type WorkflowOverrides = Partial<Workflow>

function makeWorkflowOption(overrides: WorkflowOverrides = {}): WorkflowOption {
  const workflow = fromPartial<Workflow>({
    key: 'test-key',
    path: '/workflows/test.json',
    filename: 'test.json',
    isPersisted: true,
    isModified: false,
    activeMode: 'graph',
    changeTracker: null,
    ...overrides
  })
  // markRaw keeps a stable identity through prop reactivity so the store's
  // identity-based status lookup resolves against the same object.
  return { value: 'test-key', workflow: markRaw(workflow) }
}

function renderTab({
  workflowOption = makeWorkflowOption(),
  activeWorkflowKey = 'other-key',
  activeWorkflowPath,
  otherOpenWorkflows = [],
  compact = false
}: {
  workflowOption?: WorkflowOption
  activeWorkflowKey?: string
  activeWorkflowPath?: string
  otherOpenWorkflows?: Workflow[]
  compact?: boolean
} = {}) {
  const resolvedActiveWorkflowPath =
    activeWorkflowPath ??
    (activeWorkflowKey === workflowOption.workflow.key
      ? workflowOption.workflow.path
      : '/workflows/other.json')

  useWorkflowStore().activeWorkflow = fromPartial({
    key: activeWorkflowKey,
    path: resolvedActiveWorkflowPath
  })
  useSettingStore().settingValues['Comfy.Workflow.AutoSave'] = 'off'
  const rendered = render(
    defineComponent(
      () => () =>
        h(TabsRoot, { modelValue: resolvedActiveWorkflowPath }, () =>
          h(TabsList, () =>
            h(WorkflowTab, {
              workflowOption,
              isFirst: false,
              isLast: false,
              compact
            })
          )
        )
    ),
    {
      global: { plugins: [i18n] }
    }
  )
  const workflowStore = useWorkflowStore()
  for (const workflow of [workflowOption.workflow, ...otherOpenWorkflows])
    workflowStore.attachWorkflow(workflow, 0)
  return rendered
}

describe('WorkflowTab - workflow status indicator', () => {
  beforeEach(() => {
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue(undefined)
  })

  it.for(['running', 'completed', 'failed'] as const)(
    'labels the %s indicator with a translated status name',
    (status) => {
      const workflowOption = makeWorkflowOption()
      vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue(status)

      renderTab({ workflowOption })
      expect(
        screen.getByRole('img', { name: statusAriaLabels[status] })
      ).toBeTruthy()
    }
  )

  it('does not badge the active tab with its own status', () => {
    const workflowOption = makeWorkflowOption()
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue('running')

    renderTab({ workflowOption, activeWorkflowKey: 'test-key' })
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('shows unsaved dot when no workflow status and workflow is unsaved', () => {
    renderTab({ workflowOption: makeWorkflowOption({ isPersisted: false }) })

    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByTestId('workflow-dirty-indicator')).toHaveClass(
      'bg-smoke-800'
    )
  })

  it('keeps an unsaved inactive tab dot muted when workflow keys collide', () => {
    renderTab({
      workflowOption: makeWorkflowOption({ isPersisted: false }),
      activeWorkflowKey: 'test-key',
      activeWorkflowPath: '/workflows/other.json'
    })

    expect(screen.getByTestId('workflow-dirty-indicator')).toHaveClass(
      'bg-smoke-800'
    )
  })

  it('shows the unsaved dot when modified and autosave is off', () => {
    renderTab({ workflowOption: makeWorkflowOption({ isModified: true }) })

    expect(screen.getByTestId('workflow-dirty-indicator')).toHaveClass(
      'rounded-full'
    )
  })

  it('workflow status replaces the unsaved dot', () => {
    const workflowOption = makeWorkflowOption({ isPersisted: false })
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue('running')

    renderTab({ workflowOption })
    expect(
      screen.getByRole('img', { name: statusAriaLabels.running })
    ).toBeTruthy()
    expect(screen.queryByTestId('workflow-dirty-indicator')).toBeNull()
  })
})

describe('WorkflowTab - agent activity indicators', () => {
  beforeEach(() => {
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue(undefined)
  })

  it('T-17 / PM-658 / FE-1289 renders the active workflow tab loading state', async () => {
    renderTab({ activeWorkflowKey: 'test-key' })
    useWorkflowTabActivityStore().setEditing('/workflows/test.json')
    await nextTick()

    expect(
      screen.getByRole('img', { name: agentAriaLabels.agentWorking })
    ).toBeTruthy()
  })

  it('the agent spinner wins over the unseen-changes dot', async () => {
    renderTab()
    const activity = useWorkflowTabActivityStore()
    activity.setEditing('/workflows/test.json')
    activity.markModified('/workflows/test.json')
    await nextTick()

    expect(
      screen.getByRole('img', { name: agentAriaLabels.agentWorking })
    ).toBeTruthy()
    expect(screen.queryByTestId('agent-modified-indicator')).toBeNull()
  })

  it('shows the unseen-changes dot ahead of non-failed execution status', async () => {
    const workflowOption = makeWorkflowOption()
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue('running')
    renderTab({ workflowOption })
    useWorkflowTabActivityStore().markModified('/workflows/test.json')
    await nextTick()

    expect(screen.getByTestId('agent-modified-indicator')).toHaveClass(
      'size-2',
      'bg-primary-background'
    )
    expect(
      screen.queryByRole('img', { name: statusAriaLabels.running })
    ).toBeNull()
  })

  it('a failed run outranks the unseen-changes dot', async () => {
    const workflowOption = makeWorkflowOption()
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue('failed')
    renderTab({ workflowOption })
    useWorkflowTabActivityStore().markModified('/workflows/test.json')
    await nextTick()

    expect(
      screen.getByRole('img', { name: statusAriaLabels.failed })
    ).toBeTruthy()
    expect(screen.queryByTestId('agent-modified-indicator')).toBeNull()
  })

  it('clearing the store restores the existing indicators', async () => {
    renderTab({ workflowOption: makeWorkflowOption({ isPersisted: false }) })
    const activity = useWorkflowTabActivityStore()
    activity.markModified('/workflows/test.json')
    await nextTick()
    expect(screen.queryByTestId('workflow-dirty-indicator')).toBeNull()

    activity.markSeen('/workflows/test.json')
    await nextTick()
    expect(screen.getByTestId('workflow-dirty-indicator')).toBeTruthy()
    expect(screen.queryByTestId('agent-modified-indicator')).toBeNull()
  })
})

describe('WorkflowTab - workflow card', () => {
  const OPEN_DELAY_MS = 200
  const CLOSE_DELAY_MS = 150

  function setupHover() {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  }

  function withChats(workflowOption: WorkflowOption, open = vi.fn()) {
    useWorkflowTabActivityStore().setAgentChats(
      new Map([
        [
          workflowOption.workflow.path,
          [
            { id: 'th-recent', title: 'Landscape chat', updatedAt: Date.now() },
            {
              id: 'th-older',
              title: 'Older landscape chat',
              updatedAt: Date.now() - 3 * 86_400_000
            }
          ]
        ]
      ]),
      open
    )
    return open
  }

  it('opens on a hover anywhere on the tab and stays while the pointer is in it, without switching tabs', async () => {
    const user = setupHover()
    renderTab()

    await user.hover(screen.getByTestId('close-workflow-button'))
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)
    const card = screen.getByRole('menu')
    expect(within(card).getByText('test.json')).toBeVisible()

    await user.hover(card)
    await vi.advanceTimersByTimeAsync(CLOSE_DELAY_MS * 2)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.unhover(card)
    await vi.advanceTimersByTimeAsync(CLOSE_DELAY_MS)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(useWorkflowStore().activeWorkflow?.path).toBe(
      '/workflows/other.json'
    )
  })

  it('closes, and stays closed, once the tab is clicked', async () => {
    const user = setupHover()
    renderTab()
    const tab = screen.getByRole('tab', { name: /test\.json/ })
    await user.hover(tab)
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.click(tab)
    expect(screen.queryByRole('menu')).toBeNull()

    await user.unhover(tab)
    await user.hover(tab)
    await user.click(tab)
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS * 2)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('opens from the chat indicator with the keyboard, focusing its chats, and returns focus on Escape', async () => {
    const workflowOption = makeWorkflowOption()
    withChats(workflowOption)
    renderTab({ workflowOption })
    const indicator = screen.getByRole('button', {
      name: '2 chats on test.json'
    })
    indicator.focus()

    await userEvent.keyboard('{Enter}')
    expect(
      screen.getByRole('menuitem', { name: /^Landscape chat/ })
    ).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    await vi.waitFor(() => expect(indicator).toHaveFocus())
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('offers the tab’s chats and a new chat without switching tabs', async () => {
    const workflowOption = makeWorkflowOption()
    const open = withChats(workflowOption)
    renderTab({ workflowOption })
    const indicator = screen.getByRole('button', {
      name: '2 chats on test.json'
    })

    indicator.focus()
    await userEvent.keyboard('{Enter}')
    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent)
    ).toEqual([
      'Landscape chatnow',
      'Older landscape chat3d ago',
      'New chat on this workflow'
    ])
    await userEvent.click(
      screen.getByRole('menuitem', { name: /^Older landscape chat/ })
    )
    indicator.focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'New chat on this workflow' })
    )

    expect(open.mock.calls).toEqual([
      ['/workflows/test.json', 'th-older'],
      ['/workflows/test.json', null]
    ])
    expect(useWorkflowStore().activeWorkflow?.path).toBe(
      '/workflows/other.json'
    )
  })

  it('dates each chat from when its card opens', async () => {
    const workflowOption = makeWorkflowOption()
    withChats(workflowOption)
    renderTab({ workflowOption })
    vi.setSystemTime(Date.now() + 2 * 3_600_000)

    screen.getByRole('button', { name: '2 chats on test.json' }).focus()
    await userEvent.keyboard('{Enter}')

    expect(
      screen.getByRole('menuitem', { name: /^Landscape chat/ })
    ).toHaveTextContent('2h ago')
  })

  it('shows only a chat icon, keeping the chat count in its name', () => {
    const workflowOption = makeWorkflowOption()
    useWorkflowTabActivityStore().setAgentChats(
      new Map([
        [
          workflowOption.workflow.path,
          Array.from({ length: 12 }, (_, index) => ({
            id: `th-${index}`,
            title: `Chat ${index}`,
            updatedAt: Date.now()
          }))
        ]
      ]),
      vi.fn()
    )
    renderTab({ workflowOption })

    expect(
      screen.getByRole('button', { name: '12 chats on test.json' })
    ).not.toHaveTextContent(/\S/)
  })

  it('shows no chat indicator once the agent lists no chats for the tab', async () => {
    const workflowOption = makeWorkflowOption()
    const activity = useWorkflowTabActivityStore()
    withChats(workflowOption)
    renderTab({ workflowOption })
    expect(
      screen.getByRole('button', { name: '2 chats on test.json' })
    ).toBeInTheDocument()

    activity.setAgentChats(new Map(), vi.fn())
    await nextTick()

    expect(
      screen.queryByRole('button', { name: /chats? on test\.json/ })
    ).toBeNull()
  })
})

describe('WorkflowTab - close button', () => {
  it('reveals Close on a compact inactive tab without a status indicator', () => {
    renderTab({ compact: true })

    expect(screen.getByTestId('close-workflow-button')).toHaveClass(
      'group-hover/tab:visible'
    )
  })

  it('keeps the close button hidden while an active status indicator shows', async () => {
    renderTab({ activeWorkflowKey: 'test-key' })
    useWorkflowTabActivityStore().setEditing('/workflows/test.json')
    await nextTick()

    expect(
      screen.getByRole('img', { name: agentAriaLabels.agentWorking })
    ).toBeInTheDocument()
    expect(screen.getByTestId('close-workflow-button')).toHaveClass('invisible')
    expect(screen.getByTestId('close-workflow-button')).not.toHaveClass(
      'visible'
    )
  })

  it('delegates close to workflow service with the tab workflow', async () => {
    renderTab()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('close-workflow-button'))

    expect(useWorkflowService().closeWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'test-key' }),
      expect.anything()
    )
  })
})

describe('WorkflowTab - compact', () => {
  it('keeps the mode icon on the active compact tab', () => {
    renderTab({
      workflowOption: makeWorkflowOption({ initialMode: 'app' }),
      activeWorkflowKey: 'test-key',
      compact: true
    })

    expect(screen.getByTestId('workflow-mode-icon')).toBeVisible()
  })
})

describe('WorkflowTab - Agent target', () => {
  const targetLabel = 'Agent target for this chat'

  it('keeps the target, status, and filename visible in a compact mode tab', async () => {
    const workflowOption = makeWorkflowOption({ initialMode: 'app' })
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue('running')
    renderTab({ workflowOption, compact: true })
    const panel = useAgentPanelStore()
    panel.enabled = true
    panel.setWorkflowTarget(workflowOption.workflow)
    await nextTick()

    expect(screen.queryByTestId('workflow-mode-icon')).toBeNull()
    expect(screen.getByText('test.json')).toBeVisible()
    expect(screen.getByRole('img', { name: targetLabel })).toBeVisible()
    expect(
      screen.getByRole('img', { name: statusAriaLabels.running })
    ).toBeVisible()
  })

  it('follows the selected target independently of the visible tab and panel visibility', async () => {
    const workflowOption = makeWorkflowOption()
    const other = makeWorkflowOption({ path: '/workflows/other.json' }).workflow
    renderTab({ workflowOption, otherOpenWorkflows: [other] })
    const panel = useAgentPanelStore()
    panel.enabled = true
    expect(screen.queryByRole('img', { name: targetLabel })).toBeNull()

    panel.setWorkflowTarget(workflowOption.workflow)
    await nextTick()
    expect(screen.getByRole('img', { name: targetLabel })).toBeVisible()

    panel.isOpen = true
    await nextTick()
    panel.isOpen = false
    await nextTick()
    expect(screen.getByRole('img', { name: targetLabel })).toBeVisible()

    panel.setWorkflowTarget(other)
    await nextTick()
    expect(screen.queryByRole('img', { name: targetLabel })).toBeNull()

    panel.setWorkflowTarget(workflowOption.workflow)
    await nextTick()
    expect(screen.getByRole('img', { name: targetLabel })).toBeVisible()
    panel.setWorkflowTarget(null)
    await nextTick()
    expect(screen.queryByRole('img', { name: targetLabel })).toBeNull()
  })

  it('hides a retained target when Agent is disabled', async () => {
    const workflowOption = makeWorkflowOption()
    renderTab({ workflowOption, activeWorkflowKey: 'test-key' })
    const panel = useAgentPanelStore()
    panel.enabled = true
    panel.setWorkflowTarget(workflowOption.workflow)
    await nextTick()
    expect(screen.getByRole('img', { name: targetLabel })).toBeVisible()

    panel.enabled = false
    await nextTick()
    expect(screen.queryByRole('img', { name: targetLabel })).toBeNull()
  })

  it('keeps target identity alongside Agent activity, dirty state and Close', async () => {
    const workflowOption = makeWorkflowOption({ isModified: true })
    renderTab({ workflowOption })
    const panel = useAgentPanelStore()
    panel.enabled = true
    panel.setWorkflowTarget(workflowOption.workflow)
    const activity = useWorkflowTabActivityStore()
    activity.setEditing(workflowOption.workflow.path)
    await nextTick()
    expect(screen.getByRole('img', { name: targetLabel })).toBeVisible()
    expect(
      screen.getByRole('img', { name: agentAriaLabels.agentWorking })
    ).toBeVisible()

    activity.setEditing(null)
    activity.markModified(workflowOption.workflow.path)
    await nextTick()
    expect(screen.getByRole('img', { name: targetLabel })).toBeVisible()
    expect(screen.getByTestId('agent-modified-indicator')).toBeVisible()

    activity.markSeen(workflowOption.workflow.path)
    await nextTick()
    expect(screen.getByRole('img', { name: targetLabel })).toBeVisible()
    expect(screen.getByTestId('workflow-dirty-indicator')).toBeVisible()
    await userEvent.setup().click(screen.getByTestId('close-workflow-button'))
    expect(useWorkflowService().closeWorkflow).toHaveBeenCalledWith(
      workflowOption.workflow,
      expect.anything()
    )
  })
})
