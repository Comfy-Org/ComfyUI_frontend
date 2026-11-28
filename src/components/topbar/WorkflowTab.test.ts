import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { TabsList, TabsRoot } from 'reka-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, markRaw, nextTick } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useExecutionStore } from '@/stores/executionStore'
import type { WorkflowExecutionStatus } from '@/stores/executionStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

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

vi.mock<unknown>(
  import('@/renderer/core/thumbnail/useWorkflowThumbnail'),

  () => ({
    useWorkflowThumbnail: () => ({
      getThumbnail: vi.fn(() => null)
    })
  })
)

type WorkflowTabProps = ComponentProps<typeof WorkflowTab>

const statusAriaLabels: Record<WorkflowExecutionStatus, string> = {
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed'
}

const agentAriaLabels = {
  agentWorking: enMessages.g.agentWorking,
  agentWorkingAndWorkflowRunning: enMessages.g.agentWorkingAndWorkflowRunning,
  agentFinishedUnseen: enMessages.g.agentFinishedUnseen,
  agentNeedsApproval: enMessages.g.agentNeedsApproval
}

const popoverStatusLabels = enMessages.sideToolbar.workflowTab.status

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        close: 'Close',
        ...statusAriaLabels,
        ...agentAriaLabels
      },
      sideToolbar: {
        workflowTab: {
          status: popoverStatusLabels
        }
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
  compact = false,
  triggerId
}: {
  workflowOption?: WorkflowOption
  activeWorkflowKey?: string
  activeWorkflowPath?: string
  otherOpenWorkflows?: Workflow[]
  compact?: boolean
  triggerId?: string
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
              compact,
              triggerId
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

describe('WorkflowTab - hover preview and execution status', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue(undefined)
  })

  it('delays hover preview without moving focus and dismisses after leaving', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderTab()
    const tab = screen.getByTestId('workflow-tab')
    const trigger = screen.getByRole('tab')
    trigger.focus()

    await user.hover(tab)
    await vi.advanceTimersByTimeAsync(199)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(1)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(trigger).toHaveFocus()

    await user.unhover(tab)
    await user.hover(screen.getByRole('dialog'))
    await vi.advanceTimersByTimeAsync(100)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.unhover(screen.getByRole('dialog'))
    await vi.advanceTimersByTimeAsync(99)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not reopen a click-dismissed preview when the hover delay expires', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderTab()
    const tab = screen.getByTestId('workflow-tab')

    await user.hover(tab)
    await user.click(tab)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(tab)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(200)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('lists every applicable status in the hover preview of an inactive tab', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue(
      'completed'
    )
    renderTab({ workflowOption: makeWorkflowOption({ isModified: true }) })
    useWorkflowTabActivityStore().markModified('/workflows/test.json')
    await nextTick()

    await user.hover(screen.getByTestId('workflow-tab'))
    await vi.advanceTimersByTimeAsync(200)

    const dialog = screen.getByRole('dialog')
    const statuses = within(dialog).getByTestId('workflow-tab-popover-statuses')
    expect(
      within(statuses)
        .getAllByRole('listitem')
        .map((item) => item.textContent)
    ).toEqual([
      popoverStatusLabels.agentReplied,
      popoverStatusLabels.runFinished,
      popoverStatusLabels.unsavedChanges
    ])
  })

  it('shows only the filename in the hover preview of the active tab', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderTab({
      workflowOption: makeWorkflowOption({ isModified: true }),
      activeWorkflowKey: 'test-key'
    })
    useWorkflowTabActivityStore().setAgentTurnTabs([
      { path: '/workflows/test.json', awaitingApproval: false }
    ])
    await nextTick()

    await user.hover(screen.getByTestId('workflow-tab'))
    await vi.advanceTimersByTimeAsync(200)

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('test.json')).toBeVisible()
    expect(
      within(dialog).queryByTestId('workflow-tab-popover-statuses')
    ).toBeNull()
  })

  it('opens the concurrent-status preview on keyboard focus of an inactive tab and closes on focus-out', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue(
      'completed'
    )
    renderTab({ workflowOption: makeWorkflowOption({ isModified: true }) })
    useWorkflowTabActivityStore().markModified('/workflows/test.json')
    await nextTick()

    const outside = document.createElement('button')
    document.body.append(outside)
    try {
      const trigger = screen.getByRole('tab')
      expect(trigger).toHaveAccessibleDescription(
        `${popoverStatusLabels.agentReplied}, ${popoverStatusLabels.runFinished}, ${popoverStatusLabels.unsavedChanges}`
      )

      await user.tab()
      expect(trigger).toHaveFocus()
      await vi.advanceTimersByTimeAsync(199)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await vi.advanceTimersByTimeAsync(1)

      const dialog = screen.getByRole('dialog')
      expect(trigger).toHaveFocus()
      expect(
        within(within(dialog).getByTestId('workflow-tab-popover-statuses'))
          .getAllByRole('listitem')
          .map((item) => item.textContent)
      ).toEqual([
        popoverStatusLabels.agentReplied,
        popoverStatusLabels.runFinished,
        popoverStatusLabels.unsavedChanges
      ])

      await user.tab()
      expect(screen.getByTestId('close-workflow-button')).toHaveFocus()
      await vi.advanceTimersByTimeAsync(100)
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      await user.tab()
      expect(outside).toHaveFocus()
      await vi.advanceTimersByTimeAsync(100)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    } finally {
      outside.remove()
    }
  })

  it('dismisses the focus-opened status preview on Escape and when the tab becomes active', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const workflowOption = makeWorkflowOption({ isModified: true })
    renderTab({ workflowOption })
    useWorkflowTabActivityStore().markModified('/workflows/test.json')
    await nextTick()

    const trigger = screen.getByRole('tab')
    await user.tab()
    expect(trigger).toHaveFocus()
    await vi.advanceTimersByTimeAsync(200)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    await vi.advanceTimersByTimeAsync(200)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    trigger.blur()
    await nextTick()
    trigger.focus()
    await nextTick()
    await vi.advanceTimersByTimeAsync(200)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    useWorkflowStore().activeWorkflow = fromPartial({
      key: workflowOption.workflow.key,
      path: workflowOption.workflow.path
    })
    await nextTick()
    await vi.advanceTimersByTimeAsync(100)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveAccessibleDescription('')
  })

  it('does not open the preview on focus for a plain inactive tab or an active tab', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const plain = renderTab()
    const plainTrigger = screen.getByRole('tab')
    expect(plainTrigger).toHaveAccessibleDescription('')
    await user.tab()
    expect(plainTrigger).toHaveFocus()
    await vi.advanceTimersByTimeAsync(200)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    plain.unmount()

    renderTab({
      workflowOption: makeWorkflowOption({ isModified: true }),
      activeWorkflowKey: 'test-key'
    })
    useWorkflowTabActivityStore().setAgentTurnTabs([
      { path: '/workflows/test.json', awaitingApproval: false }
    ])
    await nextTick()

    const activeTrigger = screen.getByRole('tab')
    expect(activeTrigger).toHaveAccessibleDescription('')
    await user.tab()
    expect(activeTrigger).toHaveFocus()
    await vi.advanceTimersByTimeAsync(200)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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

  it('does not badge the active tab with its own execution status', () => {
    const workflowOption = makeWorkflowOption()
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue('running')

    renderTab({ workflowOption, activeWorkflowKey: 'test-key' })
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('shows a gray unsaved dot on an inactive unsaved workflow and a white dot on the active tab', () => {
    const inactive = renderTab({
      workflowOption: makeWorkflowOption({ isPersisted: false })
    })
    expect(screen.getByText('test.json')).not.toHaveClass('italic')
    expect(screen.getByTestId('workflow-dirty-indicator')).toHaveClass(
      'bg-muted-foreground'
    )
    expect(screen.queryByTestId('workflow-tab-status')).toBeNull()
    inactive.unmount()

    renderTab({
      workflowOption: makeWorkflowOption({ isModified: true }),
      activeWorkflowKey: 'test-key'
    })
    expect(screen.getByTestId('workflow-dirty-indicator')).toHaveClass(
      'bg-foreground'
    )
  })

  it('leaves a saved, unmodified workflow plain and hides the unsaved dot while Shift is held', async () => {
    renderTab()
    expect(screen.getByText('test.json')).toBeVisible()
    expect(screen.queryByTestId('workflow-dirty-indicator')).toBeNull()

    Object.assign(useWorkflowStore(), { activeWorkflow: undefined })
    renderTab({ workflowOption: makeWorkflowOption({ isPersisted: false }) })
    expect(screen.getByTestId('workflow-dirty-indicator')).toBeVisible()

    Object.assign(useWorkspaceStore(), { shiftDown: true })
    await nextTick()
    expect(screen.queryByTestId('workflow-dirty-indicator')).toBeNull()
  })

  it('shows the left status and the right unsaved dot together', () => {
    const workflowOption = makeWorkflowOption({ isPersisted: false })
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue(
      'completed'
    )

    renderTab({ workflowOption })

    expect(
      screen.getByRole('img', { name: statusAriaLabels.completed })
    ).toBeVisible()
    expect(screen.getByTestId('workflow-dirty-indicator')).toBeVisible()
  })
})

describe('WorkflowTab - unified left status slot', () => {
  const path = '/workflows/test.json'

  beforeEach(() => {
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue(undefined)
  })

  it('shows no status indicator when neither agent nor run has activity', () => {
    renderTab()

    expect(screen.queryByTestId('workflow-tab-status')).toBeNull()
    expect(screen.getByRole('tab')).toHaveAccessibleName('test.json')
  })

  it('renders the active workflow tab busy state and announces filename first', async () => {
    renderTab({ activeWorkflowKey: 'test-key' })
    useWorkflowTabActivityStore().setAgentTurnTabs([
      { path, awaitingApproval: false }
    ])
    await nextTick()

    expect(
      screen.getByRole('img', { name: agentAriaLabels.agentWorking })
    ).toHaveAttribute('data-status', 'busy')
    expect(screen.getByRole('tab')).toHaveAccessibleName(
      `test.json ${agentAriaLabels.agentWorking}`
    )
  })

  it('shows one spinner whose label names both when agent is working and workflow is running', async () => {
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue('running')
    renderTab()
    useWorkflowTabActivityStore().setAgentTurnTabs([
      { path, awaitingApproval: false }
    ])
    await nextTick()

    expect(screen.getAllByTestId('workflow-tab-status')).toHaveLength(1)
    expect(
      screen.getByRole('img', {
        name: agentAriaLabels.agentWorkingAndWorkflowRunning
      })
    ).toHaveAttribute('data-status', 'busy')
  })

  it('shows waiting ahead of failed, busy, unseen, and completed', async () => {
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue('failed')
    renderTab()
    const activity = useWorkflowTabActivityStore()
    activity.markModified(path)
    activity.setAgentTurnTabs([{ path, awaitingApproval: true }])
    await nextTick()

    expect(screen.getAllByTestId('workflow-tab-status')).toHaveLength(1)
    expect(
      screen.getByRole('img', { name: agentAriaLabels.agentNeedsApproval })
    ).toHaveAttribute('data-status', 'waiting')

    activity.setAgentTurnTabs([{ path, awaitingApproval: false }])
    await nextTick()
    expect(
      screen.getByRole('img', { name: statusAriaLabels.failed })
    ).toHaveAttribute('data-status', 'failed')
  })

  it('shows unseen blue dot ahead of completed green check, and clears when seen', async () => {
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue(
      'completed'
    )
    renderTab()
    const activity = useWorkflowTabActivityStore()
    activity.markModified(path)
    await nextTick()

    expect(screen.getAllByTestId('workflow-tab-status')).toHaveLength(1)
    expect(
      screen.getByRole('img', { name: agentAriaLabels.agentFinishedUnseen })
    ).toHaveAttribute('data-status', 'unseen')

    activity.markSeen(path)
    await nextTick()
    expect(
      screen.getByRole('img', { name: statusAriaLabels.completed })
    ).toHaveAttribute('data-status', 'completed')
  })

  it('never renders the target icon even when a workflow is targeted', async () => {
    const workflowOption = makeWorkflowOption()
    renderTab({ workflowOption })
    const panel = useAgentPanelStore()
    panel.enabled = true
    panel.setWorkflowTarget(workflowOption.workflow)
    await nextTick()

    expect(screen.getByTestId('workflow-tab').innerHTML).not.toContain(
      'icon-[comfy--comfy-c]'
    )
  })

  it('shows no status once agent activity is cleared', async () => {
    renderTab()
    const activity = useWorkflowTabActivityStore()
    activity.markModified(path)
    await nextTick()
    expect(screen.getByTestId('workflow-tab-status')).toBeVisible()

    activity.clearAgentActivity()
    await nextTick()

    expect(screen.queryByTestId('workflow-tab-status')).toBeNull()
  })
})

describe('WorkflowTab - close button', () => {
  it('hides Close until hover when the active tab has unsaved changes, and keeps Close visible when saved', () => {
    const unsaved = renderTab({
      workflowOption: makeWorkflowOption({ isPersisted: false }),
      activeWorkflowKey: 'test-key'
    })
    expect(screen.getByTestId('workflow-dirty-indicator')).toBeVisible()
    expect(screen.getByTestId('close-workflow-button')).toHaveClass(
      'invisible',
      'group-hover/tab:visible'
    )
    unsaved.unmount()

    renderTab({
      workflowOption: makeWorkflowOption({ isPersisted: true }),
      activeWorkflowKey: 'test-key'
    })
    expect(screen.getByTestId('close-workflow-button')).toHaveClass('visible')
    expect(screen.getByTestId('close-workflow-button')).not.toHaveClass(
      'invisible'
    )
  })

  it('reveals Close on hover even on compact inactive tabs with status and unsaved changes', () => {
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue('running')
    renderTab({
      workflowOption: makeWorkflowOption({ isPersisted: false }),
      compact: true
    })

    expect(
      screen.getByRole('img', { name: statusAriaLabels.running })
    ).toBeVisible()
    expect(screen.getByTestId('workflow-dirty-indicator')).toBeVisible()
    expect(screen.getByTestId('close-workflow-button')).toHaveClass(
      'group-hover/tab:visible'
    )
  })

  it('delegates close to workflow service as a user action on the tab workflow', async () => {
    renderTab()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('close-workflow-button'))

    expect(useWorkflowService().closeWorkflows).toHaveBeenCalledWith(
      [expect.objectContaining({ key: 'test-key' })],
      expect.objectContaining({ initiator: 'user' })
    )
    expect(useWorkflowService().closeWorkflow).not.toHaveBeenCalled()
  })

  it('uses a space-free tab trigger id when the workflow path contains spaces', () => {
    renderTab({
      workflowOption: makeWorkflowOption({
        path: 'workflows/Unsaved Workflow.json',
        filename: 'Unsaved Workflow'
      })
    })

    const tab = screen.getByRole('tab')
    expect(tab.id).toMatch(/^workflow-tab-trigger-\S+$/)
  })

  it('applies an explicit triggerId to the rendered tab button', () => {
    renderTab({
      triggerId: 'workflow-tab-trigger-custom-0'
    })

    const tab = screen.getByRole('tab')
    expect(tab).toHaveAttribute('id', 'workflow-tab-trigger-custom-0')
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
