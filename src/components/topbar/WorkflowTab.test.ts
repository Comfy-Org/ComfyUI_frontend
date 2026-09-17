import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { markRaw, nextTick } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useExecutionStore } from '@/stores/executionStore'
import type { WorkflowExecutionStatus } from '@/stores/executionStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

import WorkflowTab from './WorkflowTab.vue'
vi.mock(import('firebase/auth'))
vi.mock(import('vuefire'), () => ({ useFirebaseAuth: vi.fn() }))
const mockCloseWorkflow = vi.hoisted(() => vi.fn().mockResolvedValue(true))

vi.mock(import('@/composables/usePragmaticDragAndDrop'), () => ({
  usePragmaticDraggable: vi.fn(),
  usePragmaticDroppable: vi.fn()
}))

vi.mock<unknown>(import('@/composables/useWorkflowActionsMenu'), () => ({
  useWorkflowActionsMenu: () => ({
    menuItems: { value: [] }
  })
}))

vi.mock<unknown>(
  import('@/platform/workflow/core/services/workflowService'),
  () => ({
    useWorkflowService: () => ({
      closeWorkflow: mockCloseWorkflow
    })
  })
)

vi.mock<unknown>(
  import('@/renderer/core/thumbnail/useWorkflowThumbnail'),

  () => ({
    useWorkflowThumbnail: () => ({
      getThumbnail: vi.fn(() => null)
    })
  })
)

vi.mock<unknown>(import('./WorkflowTabPopover.vue'), () => ({
  default: {
    render: () => null,
    methods: {
      showPopover: () => {},
      hidePopover: () => {},
      togglePopover: () => {}
    }
  }
}))

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
      g: { close: 'Close', ...statusAriaLabels, ...agentAriaLabels },
      agent: { targetForThisChat: 'Agent target for this chat' }
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
  otherOpenWorkflows = []
}: {
  workflowOption?: WorkflowOption
  activeWorkflowKey?: string
  activeWorkflowPath?: string
  otherOpenWorkflows?: Workflow[]
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
  const rendered = render(WorkflowTab, {
    global: {
      plugins: [i18n],
      stubs: {
        WorkflowActionsList: true,
        Button: {
          template: '<button v-bind="$attrs"><slot /></button>'
        }
      }
    },
    props: {
      workflowOption,
      isFirst: false,
      isLast: false
    }
  })
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

describe('WorkflowTab - close button', () => {
  it('delegates close to workflow service with the tab workflow', async () => {
    renderTab()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('close-workflow-button'))

    expect(mockCloseWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'test-key' }),
      expect.anything()
    )
  })
})

describe('WorkflowTab - Agent target', () => {
  const targetLabel = 'Agent target for this chat'

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
    expect(mockCloseWorkflow).toHaveBeenCalledWith(
      workflowOption.workflow,
      expect.anything()
    )
  })
})
