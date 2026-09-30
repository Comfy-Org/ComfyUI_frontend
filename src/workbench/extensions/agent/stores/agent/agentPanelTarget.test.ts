import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAgentPanelStore } from './agentPanelStore'

vi.mock(import('@/platform/telemetry'), () => ({
  useTelemetry: () => null
}))

async function setup() {
  const workflows = useWorkflowStore()
  const target = await workflows.createTemporary('a.json').load()
  const other = await workflows.createTemporary('b.json').load()
  workflows.openWorkflowsInBackground({ right: [target.path, other.path] })
  const panel = useAgentPanelStore()
  panel.setWorkflowTarget(target)
  return { workflows, panel, target, other }
}

describe('Agent target tab lifetime', () => {
  it('clears a closed target with no panel mounted and does not retarget on reopening', async () => {
    const { workflows, panel, target } = await setup()
    await nextTick()
    expect(panel.selectedWorkflow?.path).toBe(target.path)
    await workflows.closeWorkflow(target)
    await nextTick()
    expect(panel.selectedWorkflow).toBeNull()
    panel.initializeTargetTracking(true)
    expect(panel.canRestoreWorkflow).toBe(false)
    expect(panel.followsVisibleWorkflow).toBe(false)
    const reopened = workflows.createTemporary('a.json')
    workflows.openWorkflowsInBackground({ right: [reopened.path] })
    await nextTick()
    expect(panel.selectedWorkflow).toBeNull()
  })

  it('retains a renamed target when another tab closes', async () => {
    const { workflows, panel, target, other } = await setup()
    vi.spyOn(target, 'rename').mockImplementation(async (path) => {
      target.path = path
      return target
    })
    await workflows.renameWorkflow(target, 'workflows/renamed.json')
    await workflows.closeWorkflow(other)
    await nextTick()
    expect(panel.selectedWorkflow?.path).toBe('workflows/renamed.json')
  })
})

type TargetSetup = Awaited<ReturnType<typeof setup>>

function saveTarget(target: ComfyWorkflow): void {
  target.size = 1
  vi.spyOn(target, 'delete').mockResolvedValue()
}

describe('Agent target deletion', () => {
  it.for([
    {
      event: 'deleting the saved target after its tab closes',
      act: async ({ workflows, target }: TargetSetup) => {
        saveTarget(target)
        await workflows.closeWorkflow(target)
        await nextTick()
        await workflows.deleteWorkflow(target)
      },
      unavailable: true,
      selected: undefined
    },
    {
      event: 'deleting the saved target while its tab is open',
      act: async ({ workflows, target }: TargetSetup) => {
        saveTarget(target)
        await workflows.deleteWorkflow(target)
      },
      unavailable: true,
      selected: undefined
    },
    {
      event: 'deleting an unsaved target, which only closes it',
      act: async ({ workflows, target }: TargetSetup) =>
        workflows.deleteWorkflow(target),
      unavailable: false,
      selected: undefined
    },
    {
      event: 'renaming, then deleting, the closed saved target',
      act: async ({ workflows, target }: TargetSetup) => {
        saveTarget(target)
        vi.spyOn(target, 'rename').mockImplementation(async (path) => {
          target.path = path
          return target
        })
        await workflows.closeWorkflow(target)
        await nextTick()
        await workflows.renameWorkflow(target, 'workflows/renamed.json')
        await workflows.deleteWorkflow(target)
      },
      unavailable: true,
      selected: undefined
    },
    {
      event: 'deleting a closed saved target after it is reopened',
      act: async ({ workflows, target }: TargetSetup) => {
        saveTarget(target)
        await workflows.closeWorkflow(target)
        await nextTick()
        workflows.openWorkflowsInBackground({ right: [target.path] })
        await nextTick()
        await workflows.deleteWorkflow(target)
      },
      unavailable: false,
      selected: undefined
    },
    {
      event: 'deleting the saved target after the chat cleared it mid-delete',
      act: async ({ workflows, panel, target }: TargetSetup) => {
        saveTarget(target)
        let finishDelete = () => {}
        vi.spyOn(target, 'delete').mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              finishDelete = resolve
            })
        )
        const deleting = workflows.deleteWorkflow(target)
        panel.setWorkflowTarget(null)
        finishDelete()
        await deleting
      },
      unavailable: false,
      selected: undefined
    },
    {
      event: 'only closing the target',
      act: async ({ workflows, target }: TargetSetup) =>
        workflows.closeWorkflow(target),
      unavailable: false,
      selected: undefined
    },
    {
      event: 'deleting another workflow',
      act: async ({ workflows, other }: TargetSetup) => {
        await workflows.closeWorkflow(other)
        await nextTick()
        await workflows.deleteWorkflow(other)
      },
      unavailable: false,
      selected: 'workflows/a.json'
    },
    {
      event: 'deleting the visible workflow a fresh chat follows',
      act: async ({ workflows, panel, target, other }: TargetSetup) => {
        panel.startFollowingVisibleWorkflow()
        workflows.activeWorkflow = target
        await nextTick()
        workflows.activeWorkflow = other
        await workflows.closeWorkflow(target)
        await nextTick()
        await workflows.deleteWorkflow(target)
      },
      unavailable: false,
      selected: 'workflows/b.json'
    },
    {
      event: 'deleting the old target after choosing another',
      act: async ({ workflows, panel, target, other }: TargetSetup) => {
        await workflows.closeWorkflow(target)
        await nextTick()
        panel.setWorkflowTarget(other)
        await workflows.deleteWorkflow(target)
      },
      unavailable: false,
      selected: 'workflows/b.json'
    }
  ])(
    'reports the target unavailable after $event: $unavailable',
    async ({ act, unavailable, selected }) => {
      const context = await setup()
      await nextTick()

      await act(context)
      await nextTick()

      expect(context.panel.targetUnavailable).toBe(unavailable)
      expect(context.panel.selectedWorkflow?.path).toBe(selected)
    }
  )

  it.for([
    {
      kind: 'temporary',
      prepare: (_target: ComfyWorkflow) => {},
      tracking: { mode: 'retained', workflow: null }
    },
    {
      kind: 'saved',
      prepare: saveTarget,
      tracking: {
        mode: 'retained',
        workflow: null,
        closedPath: 'workflows/a.json'
      }
    }
  ])(
    'keeps no workflow object once a $kind target closes',
    async ({ prepare, tracking }) => {
      const { workflows, panel, target } = await setup()
      prepare(target)
      await nextTick()

      await workflows.closeWorkflow(target)
      await nextTick()

      expect(panel.targetTracking).toEqual(tracking)
    }
  )
})

describe('Agent target tracking policy', () => {
  it('leaves the target undecided while startup is unresolved', async () => {
    const workflows = useWorkflowStore()
    const panel = useAgentPanelStore()
    workflows.activeWorkflow = await workflows.createTemporary('a.json').load()
    expect(panel.selectedWorkflow).toBeNull()
    workflows.activeWorkflow = await workflows.createTemporary('b.json').load()
    expect(panel.selectedWorkflow).toBeNull()
    expect(panel.followsVisibleWorkflow).toBe(false)
  })

  it('derives a fresh target and tab changes without a mounted panel', async () => {
    const workflows = useWorkflowStore()
    const panel = useAgentPanelStore()
    const a = await workflows.createTemporary('a.json').load()
    const b = await workflows.createTemporary('b.json').load()
    workflows.activeWorkflow = a
    panel.initializeTargetTracking(false)
    expect(panel.selectedWorkflow?.path).toBe(a.path)
    workflows.activeWorkflow = b
    expect(panel.selectedWorkflow?.path).toBe(b.path)
  })

  it('retains the chosen target across navigation and repeated startup', async () => {
    const { workflows, panel, target, other } = await setup()
    workflows.activeWorkflow = other
    panel.initializeTargetTracking(false)
    expect(panel.selectedWorkflow?.path).toBe(target.path)
    expect(panel.followsVisibleWorkflow).toBe(false)
    expect(panel.canRestoreWorkflow).toBe(false)
  })

  it('continues following the replacement when the visible tab closes', async () => {
    const { workflows, panel, target, other } = await setup()
    workflows.activeWorkflow = target
    panel.startFollowingVisibleWorkflow()
    await workflows.closeWorkflow(target)
    await nextTick()
    workflows.activeWorkflow = other
    expect(panel.selectedWorkflow?.path).toBe(other.path)
    expect(panel.followsVisibleWorkflow).toBe(true)
  })

  it('captures a followed workflow on commitment and only New Chat resumes following', async () => {
    const { workflows, panel, target, other } = await setup()
    workflows.activeWorkflow = target
    panel.startFollowingVisibleWorkflow()
    panel.retainWorkflowTarget()
    workflows.activeWorkflow = other
    panel.initializeTargetTracking(false)
    expect(panel.selectedWorkflow?.path).toBe(target.path)
    expect(panel.followsVisibleWorkflow).toBe(false)
    panel.startFollowingVisibleWorkflow()
    expect(panel.selectedWorkflow?.path).toBe(other.path)
  })

  it.for([
    {
      event: 'choosing a workflow',
      act: (
        panel: ReturnType<typeof useAgentPanelStore>,
        other: ComfyWorkflow
      ) => panel.setWorkflowTarget(other),
      selected: 'workflows/b.json'
    },
    {
      event: 'starting a new chat',
      act: (panel: ReturnType<typeof useAgentPanelStore>) =>
        panel.startFollowingVisibleWorkflow(),
      selected: 'workflows/a.json'
    },
    {
      event: 'restoring another chat',
      act: (panel: ReturnType<typeof useAgentPanelStore>) =>
        panel.beginWorkflowRestoration(),
      selected: undefined
    }
  ])('clears an unavailable target after $event', async ({ act, selected }) => {
    const { workflows, panel, target, other } = await setup()
    workflows.activeWorkflow = target
    panel.markWorkflowTargetUnavailable()
    expect(panel.targetUnavailable).toBe(true)
    expect(panel.selectedWorkflow).toBeNull()

    act(panel, other)

    expect(panel.targetUnavailable).toBe(false)
    expect(panel.selectedWorkflow?.path).toBe(selected)
  })

  it('separates history restoration from an explicitly cleared target', async () => {
    const { workflows, panel, other } = await setup()
    panel.setWorkflowTarget(null)
    panel.initializeTargetTracking(true)
    workflows.activeWorkflow = other
    expect(panel.selectedWorkflow).toBeNull()
    expect(panel.canRestoreWorkflow).toBe(false)
    panel.beginWorkflowRestoration()
    expect(panel.selectedWorkflow).toBeNull()
    expect(panel.canRestoreWorkflow).toBe(true)
    expect(panel.followsVisibleWorkflow).toBe(false)
  })

  it('keeps restoration eligible through navigation while waiting for history', async () => {
    const workflows = useWorkflowStore()
    const panel = useAgentPanelStore()
    panel.initializeTargetTracking(true)
    workflows.activeWorkflow = await workflows.createTemporary('a.json').load()
    expect(panel.selectedWorkflow).toBeNull()
    expect(panel.followsVisibleWorkflow).toBe(false)
    expect(panel.canRestoreWorkflow).toBe(true)
    panel.setWorkflowTarget(workflows.activeWorkflow)
    expect(panel.canRestoreWorkflow).toBe(false)
    expect(panel.followsVisibleWorkflow).toBe(false)
  })
})
