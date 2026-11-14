import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
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
  agentModified: enMessages.g.agentModified,
  agentNeedsApproval: enMessages.g.agentNeedsApproval,
  agentChat: enMessages.g.agentChat
}

const unsavedLabel = enMessages.g.unsavedChanges

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        close: 'Close',
        unsavedChanges: unsavedLabel,
        ...statusAriaLabels,
        ...agentAriaLabels
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

  it('TS-09 marks an unsaved workflow with an italic name and an asterisk, not a dot', () => {
    renderTab({ workflowOption: makeWorkflowOption({ isPersisted: false }) })

    expect(screen.getByText('test.json')).toHaveClass('italic')
    const asterisk = screen.getByRole('img', { name: unsavedLabel })
    expect(asterisk).toBe(screen.getByTestId('workflow-dirty-indicator'))
    expect(asterisk).toHaveClass('italic', "after:content-['*']")
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(screen.queryByTestId('workflow-chat-status')).toBeNull()
  })

  it('TS-09 marks a modified workflow the same way when autosave is off', () => {
    renderTab({ workflowOption: makeWorkflowOption({ isModified: true }) })

    expect(screen.getByText('test.json')).toHaveClass('italic')
    expect(screen.getByTestId('workflow-dirty-indicator')).toBeVisible()
  })

  it('TS-09 leaves a saved, unmodified workflow plain', () => {
    renderTab()

    expect(screen.getByText('test.json')).not.toHaveClass('italic')
    expect(screen.queryByTestId('workflow-dirty-indicator')).toBeNull()
  })

  it('TS-09 shows no mark while Shift is held', async () => {
    renderTab({ workflowOption: makeWorkflowOption({ isPersisted: false }) })
    expect(screen.getByTestId('workflow-dirty-indicator')).toBeVisible()

    Object.assign(useWorkspaceStore(), { shiftDown: true })
    await nextTick()

    expect(screen.queryByTestId('workflow-dirty-indicator')).toBeNull()
    expect(screen.getByText('test.json')).not.toHaveClass('italic')
  })

  it('TS-10 keeps the asterisk outside the part of the name that is cut', () => {
    renderTab({
      workflowOption: makeWorkflowOption({
        isPersisted: false,
        filename: 'a-very-long-workflow-name-that-does-not-fit'
      })
    })

    const name = screen.getByText('a-very-long-workflow-name-that-does-not-fit')
    const asterisk = screen.getByTestId('workflow-dirty-indicator')
    expect(name).toHaveClass('truncate')
    expect(name).not.toContainElement(asterisk)
    expect(asterisk).toHaveClass('shrink-0')
  })

  it('TS-11 shows the run status of a background tab next to the unsaved mark', () => {
    const workflowOption = makeWorkflowOption({ isPersisted: false })
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue('running')

    renderTab({ workflowOption })

    expect(
      screen.getByRole('img', { name: statusAriaLabels.running })
    ).toBeVisible()
    expect(screen.getByTestId('workflow-dirty-indicator')).toBeVisible()
  })

  it('TS-11 treats a tab that shares the active tab key, but not its path, as a background tab', () => {
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue('running')

    renderTab({
      workflowOption: makeWorkflowOption(),
      activeWorkflowKey: 'test-key',
      activeWorkflowPath: '/workflows/other.json'
    })

    expect(
      screen.getByRole('img', { name: statusAriaLabels.running })
    ).toBeVisible()
  })
})

describe('WorkflowTab - chat status', () => {
  const path = '/workflows/test.json'

  beforeEach(() => {
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue(undefined)
  })

  it('TS-01 shows no chat status on a tab without a chat', () => {
    renderTab()

    expect(screen.queryByTestId('workflow-chat-status')).toBeNull()
  })

  it.for([
    { name: 'a background tab', activeWorkflowKey: 'other-key' },
    { name: 'the active tab', activeWorkflowKey: 'test-key' }
  ])(
    'TS-02 shows a gray dot on $name that has a chat',
    async ({ activeWorkflowKey }) => {
      renderTab({ activeWorkflowKey })
      useWorkflowTabActivityStore().setChatPaths([path])
      await nextTick()

      expect(
        screen.getByRole('img', { name: agentAriaLabels.agentChat })
      ).toHaveClass('bg-muted-foreground')
    }
  )

  it('T-17 / PM-658 / FE-1289 renders the active workflow tab loading state', async () => {
    renderTab({ activeWorkflowKey: 'test-key' })
    useWorkflowTabActivityStore().setAgentTurnTabs([
      { path, awaitingApproval: false }
    ])
    await nextTick()

    expect(
      screen.getByRole('img', { name: agentAriaLabels.agentWorking })
    ).toBeTruthy()
  })

  it('TS-04 shows the waiting dot ahead of the spinner', async () => {
    renderTab()
    const activity = useWorkflowTabActivityStore()
    activity.setAgentTurnTabs([{ path, awaitingApproval: true }])
    await nextTick()

    expect(
      screen.getByRole('img', { name: agentAriaLabels.agentNeedsApproval })
    ).toHaveClass('bg-warning')
    expect(
      screen.queryByRole('img', { name: agentAriaLabels.agentWorking })
    ).toBeNull()

    activity.setAgentTurnTabs([{ path, awaitingApproval: false }])
    await nextTick()
    expect(
      screen.queryByRole('img', { name: agentAriaLabels.agentNeedsApproval })
    ).toBeNull()
    expect(
      screen.getByRole('img', { name: agentAriaLabels.agentWorking })
    ).toBeVisible()
  })

  it('TS-05 shows a green dot for a finished turn until the tab is seen, then a gray one', async () => {
    renderTab()
    const activity = useWorkflowTabActivityStore()
    activity.setChatPaths([path])
    activity.markModified(path)
    await nextTick()

    expect(
      screen.getByRole('img', { name: agentAriaLabels.agentModified })
    ).toHaveClass('bg-success')

    activity.markSeen(path)
    await nextTick()
    expect(
      screen.queryByRole('img', { name: agentAriaLabels.agentModified })
    ).toBeNull()
    expect(
      screen.getByRole('img', { name: agentAriaLabels.agentChat })
    ).toBeVisible()
  })

  it('TS-07 shows one chat indicator when several states hold', async () => {
    renderTab()
    const activity = useWorkflowTabActivityStore()
    activity.setChatPaths([path])
    activity.markModified(path)
    activity.setAgentTurnTabs([{ path, awaitingApproval: false }])
    await nextTick()

    expect(screen.getAllByTestId('workflow-chat-status')).toHaveLength(1)
    expect(
      screen.getByRole('img', { name: agentAriaLabels.agentWorking })
    ).toBeVisible()
  })

  it('TS-09 shows the chat status and the unsaved mark together, each once', async () => {
    renderTab({ workflowOption: makeWorkflowOption({ isModified: true }) })
    useWorkflowTabActivityStore().setChatPaths([path])
    await nextTick()

    expect(
      screen.getByRole('img', { name: agentAriaLabels.agentChat })
    ).toBeVisible()
    expect(screen.getByTestId('workflow-dirty-indicator')).toBeVisible()
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })

  it('TS-11 shows a failed run and an unseen chat together', async () => {
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue('failed')
    renderTab()
    useWorkflowTabActivityStore().markModified(path)
    await nextTick()

    expect(
      screen.getByRole('img', { name: statusAriaLabels.failed })
    ).toBeVisible()
    expect(
      screen.getByRole('img', { name: agentAriaLabels.agentModified })
    ).toBeVisible()
  })

  it('TS-11 shows a running run and an unseen chat together', async () => {
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue('running')
    renderTab()
    useWorkflowTabActivityStore().markModified(path)
    await nextTick()

    expect(
      screen.getByRole('img', { name: statusAriaLabels.running })
    ).toBeVisible()
    expect(
      screen.getByRole('img', { name: agentAriaLabels.agentModified })
    ).toBeVisible()
  })

  it('TS-14 shows no chat status once the agent activity is cleared', async () => {
    renderTab()
    const activity = useWorkflowTabActivityStore()
    activity.setChatPaths([path])
    activity.markModified(path)
    await nextTick()
    expect(screen.getByTestId('workflow-chat-status')).toBeVisible()

    activity.clearAgentActivity()
    await nextTick()

    expect(screen.queryByTestId('workflow-chat-status')).toBeNull()
  })
})

describe('WorkflowTab - close button', () => {
  it('reveals Close on a compact inactive tab without a run status', () => {
    renderTab({ compact: true })

    expect(screen.getByTestId('close-workflow-button')).toHaveClass(
      'group-hover/tab:visible'
    )
  })

  it('TS-12 keeps Close visible on the active tab while a chat status shows', async () => {
    renderTab({ activeWorkflowKey: 'test-key' })
    useWorkflowTabActivityStore().setAgentTurnTabs([
      { path: '/workflows/test.json', awaitingApproval: false }
    ])
    await nextTick()

    expect(
      screen.getByRole('img', { name: agentAriaLabels.agentWorking })
    ).toBeInTheDocument()
    expect(screen.getByTestId('close-workflow-button')).toHaveClass('visible')
    expect(screen.getByTestId('close-workflow-button')).not.toHaveClass(
      'invisible'
    )
  })

  it('TS-12 keeps Close visible on the active tab while it is unsaved', () => {
    renderTab({
      workflowOption: makeWorkflowOption({ isPersisted: false }),
      activeWorkflowKey: 'test-key'
    })

    expect(screen.getByTestId('workflow-dirty-indicator')).toBeVisible()
    expect(screen.getByTestId('close-workflow-button')).toHaveClass('visible')
  })

  it('TS-12 reveals Close on hover on a compact inactive tab that is unsaved or has a chat', async () => {
    renderTab({
      workflowOption: makeWorkflowOption({ isPersisted: false }),
      compact: true
    })
    useWorkflowTabActivityStore().setChatPaths(['/workflows/test.json'])
    await nextTick()

    expect(screen.getByTestId('workflow-dirty-indicator')).toBeVisible()
    expect(screen.getByTestId('workflow-chat-status')).toBeVisible()
    expect(screen.getByTestId('close-workflow-button')).toHaveClass(
      'group-hover/tab:visible'
    )
  })

  it('TS-12 keeps the run status of a compact inactive tab in place on hover', () => {
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue('running')
    renderTab({ compact: true })

    expect(
      screen.getByRole('img', { name: statusAriaLabels.running })
    ).toBeVisible()
    expect(screen.getByTestId('close-workflow-button')).not.toHaveClass(
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

describe('WorkflowTab - chat status next to the other tab content', () => {
  it('keeps the chat status, run status and filename visible in a compact mode tab', async () => {
    const workflowOption = makeWorkflowOption({ initialMode: 'app' })
    vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue('running')
    renderTab({ workflowOption, compact: true })
    useWorkflowTabActivityStore().setChatPaths([workflowOption.workflow.path])
    await nextTick()

    expect(screen.queryByTestId('workflow-mode-icon')).toBeNull()
    expect(screen.getByText('test.json')).toBeVisible()
    expect(
      screen.getByRole('img', { name: agentAriaLabels.agentChat })
    ).toBeVisible()
    expect(
      screen.getByRole('img', { name: statusAriaLabels.running })
    ).toBeVisible()
  })

  it('keeps the chat status and the unsaved mark beside a working Close button', async () => {
    const workflowOption = makeWorkflowOption({ isModified: true })
    renderTab({ workflowOption, activeWorkflowKey: 'test-key' })
    useWorkflowTabActivityStore().setAgentTurnTabs([
      { path: workflowOption.workflow.path, awaitingApproval: false }
    ])
    await nextTick()
    expect(
      screen.getByRole('img', { name: agentAriaLabels.agentWorking })
    ).toBeVisible()
    expect(screen.getByTestId('workflow-dirty-indicator')).toBeVisible()

    await userEvent.setup().click(screen.getByTestId('close-workflow-button'))

    expect(useWorkflowService().closeWorkflows).toHaveBeenCalledWith(
      [workflowOption.workflow],
      expect.objectContaining({ initiator: 'user' })
    )
  })
})
