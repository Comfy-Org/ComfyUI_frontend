import { fromPartial } from '@total-typescript/shoehorn'
import {
  createPinia,
  disposePinia,
  getActivePinia,
  setActivePinia
} from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

import type { CloudWorkflowEntry } from '../../schemas/agentApiSchema'
import { useAgentWorkflowTabBindingStore } from '../../stores/agent/agentWorkflowTabBindingStore'

import { useAgentWorkflowResolver } from './useAgentWorkflowResolver'

vi.mock('@/platform/telemetry/reportError', () => ({ reportError: vi.fn() }))

function workflow(
  path: string,
  filename: string,
  overrides: Partial<ComfyWorkflow> = {}
) {
  return fromPartial<ComfyWorkflow>({
    path,
    filename,
    suffix: 'json',
    isTemporary: false,
    ...overrides
  })
}

function setup(
  open: ComfyWorkflow[],
  cloud: CloudWorkflowEntry[] = [],
  closed: ComfyWorkflow[] = []
) {
  const workflows = reactive({
    openWorkflows: open,
    workflows: [...open, ...closed],
    getWorkflowByPath(path: string): ComfyWorkflow | null {
      return this.workflows.find((candidate) => candidate.path === path) ?? null
    }
  })
  const bindings = useAgentWorkflowTabBindingStore()
  const listCloudWorkflows = vi.fn(
    async (): Promise<CloudWorkflowEntry[]> => cloud
  )
  const resolver = useAgentWorkflowResolver({
    workflows,
    bindings,
    listCloudWorkflows
  })
  return { workflows, bindings, listCloudWorkflows, resolver }
}

describe('Agent workflow resolution', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => {
    const pinia = getActivePinia()
    if (pinia) disposePinia(pinia)
  })

  it('uses unique saved names ahead of old bindings and re-evaluates renamed workflows', async () => {
    const { resolver, workflows, bindings } = setup(
      [workflow('workflows/local.json', 'Portrait')],
      [{ id: 'cloud-portrait', name: 'Portrait' }]
    )
    const tab = workflows.openWorkflows[0]
    bindings.bind('old-binding', tab.path)
    await resolver.refreshCloudWorkflowIds()
    expect(resolver.cloudIdFor(tab)).toBe('cloud-portrait')
    tab.filename = 'Renamed'
    expect(resolver.cloudIdFor(tab)).toBe('old-binding')
    expect(resolver.availableWorkflowReferences.value).toEqual([
      { id: 'old-binding', name: 'Renamed' }
    ])
    expect(bindings.workflowIdFor(tab.path)).toBe('old-binding')
  })

  it('does not infer identity from duplicate local names, duplicate Cloud names or temporary tabs', async () => {
    const { resolver, workflows, bindings } = setup(
      [
        workflow('a/shared.json', 'Shared'),
        workflow('b/shared.json', 'Shared'),
        workflow('workflows/ambiguous.json', 'Ambiguous'),
        workflow('workflows/scratch.json', 'Scratch', { isTemporary: true })
      ],
      [
        { id: 'cloud-shared', name: 'Shared' },
        { id: 'cloud-ambiguous-1', name: 'Ambiguous' },
        { id: 'cloud-ambiguous-2', name: 'Ambiguous' },
        { id: 'cloud-scratch', name: 'Scratch' },
        { id: 'cloud-nameless' }
      ]
    )
    await resolver.refreshCloudWorkflowIds()
    expect(workflows.openWorkflows.map(resolver.cloudIdFor)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined
    ])
    bindings.bind('explicit-shared', workflows.openWorkflows[0].path)
    expect(resolver.availableWorkflowReferences.value).toEqual([
      { id: 'explicit-shared', name: 'Shared' }
    ])
    expect(resolver.storedWorkflowFor('cloud-shared')).toBeNull()
    expect(resolver.boundWorkflowFor('cloud-ambiguous-1')).toBeNull()
  })

  it('distinguishes open references from stored and explicitly bound closed workflows', async () => {
    const { resolver, workflows, bindings } = setup(
      [workflow('workflows/a.json', 'A')],
      [
        { id: 'cloud-a', name: 'A' },
        { id: 'cloud-b', name: 'B' }
      ],
      [workflow('workflows/b.json', 'B')]
    )
    await resolver.refreshCloudWorkflowIds()
    expect(resolver.openWorkflowFor('cloud-a')).toBe(workflows.openWorkflows[0])
    expect(resolver.openWorkflowFor('cloud-b')).toBeNull()
    expect(resolver.boundWorkflowFor('cloud-b')).toBeNull()
    expect(resolver.storedWorkflowFor('cloud-b')).toBe(workflows.workflows[1])
    bindings.bind('cloud-b', 'workflows/b.json')
    expect(resolver.boundWorkflowFor('cloud-b')).toBe(workflows.workflows[1])
    expect(resolver.openWorkflowFor('cloud-b')).toBeNull()
  })

  it('keeps editor snapshot order and app suffixes separate from display names', async () => {
    const { resolver, workflows } = setup(
      [
        workflow('workflows/app.app.json', 'Portrait', { suffix: 'app.json' }),
        workflow('workflows/plain.json', 'Portrait'),
        workflow('workflows/unknown.json', 'Unknown')
      ],
      [
        { id: 'cloud-app', name: 'Portrait.app' },
        { id: 'cloud-graph', name: 'Portrait' }
      ]
    )
    await resolver.refreshCloudWorkflowIds()
    expect(resolver.openTabsSnapshot()).toEqual({
      open_tabs: [
        { workflow_id: 'cloud-app', name: 'Portrait.app' },
        { workflow_id: 'cloud-graph', name: 'Portrait' }
      ]
    })
    expect(resolver.availableWorkflowReferences.value).toEqual([
      { id: 'cloud-app', name: 'Portrait' },
      { id: 'cloud-graph', name: 'Portrait' }
    ])
    workflows.openWorkflows.reverse()
    expect(
      resolver.openTabsSnapshot()?.open_tabs?.map((tab) => tab.workflow_id)
    ).toEqual(['cloud-graph', 'cloud-app'])
    workflows.openWorkflows = []
    expect(resolver.openTabsSnapshot()).toBeUndefined()
    expect(resolver.availableWorkflowReferences.value).toEqual([])
  })

  it('deduplicates reference candidates without changing the editor snapshot', async () => {
    const { resolver } = setup(
      [
        workflow('workflows/old.json', 'Old'),
        workflow('workflows/new.json', 'New')
      ],
      [{ id: 'cloud-renamed', name: 'New' }]
    )
    const bindings = useAgentWorkflowTabBindingStore()
    bindings.bind('cloud-renamed', 'workflows/old.json')
    await resolver.refreshCloudWorkflowIds()
    expect(resolver.availableWorkflowReferences.value).toEqual([
      { id: 'cloud-renamed', name: 'Old' }
    ])
    expect(resolver.openTabsSnapshot()?.open_tabs).toHaveLength(2)
  })

  it('chooses a save name against local and Cloud collisions with app suffixes', async () => {
    const scratch = workflow('scratch/Draft.app.json', 'Draft', {
      isTemporary: true,
      initialMode: 'app'
    })
    const { resolver } = setup(
      [scratch],
      [{ id: 'cloud-draft', name: 'Draft.app' }],
      [
        workflow('workflows/Draft (2).app.json', 'Draft (2)', {
          suffix: 'app.json'
        }),
        workflow('workflows/Draft (3).json', 'Draft (3)')
      ]
    )
    await resolver.refreshCloudWorkflowIds()
    expect(resolver.nextSaveFilename(scratch)).toBe('Draft (3)')
  })

  it.for(['success', 'failure'])(
    'ignores a superseded refresh outcome: %s',
    async (outcome) => {
      const { resolver, listCloudWorkflows } = setup([
        workflow('workflows/current.json', 'Current')
      ])
      let resolveFirst: (entries: CloudWorkflowEntry[]) => void = () => {}
      let rejectFirst: (error: Error) => void = () => {}
      listCloudWorkflows.mockReturnValueOnce(
        new Promise((resolve, reject) => {
          resolveFirst = resolve
          rejectFirst = reject
        })
      )
      listCloudWorkflows.mockResolvedValueOnce([
        { id: 'latest', name: 'Current' }
      ])
      const first = resolver.refreshCloudWorkflowIds()
      expect(await resolver.refreshCloudWorkflowIds()).toBe(true)
      if (outcome === 'success')
        resolveFirst([{ id: 'stale', name: 'Current' }])
      else rejectFirst(new Error('Stale failure'))
      expect(await first).toBe(false)
      expect(resolver.availableWorkflowReferences.value).toEqual([
        { id: 'latest', name: 'Current' }
      ])
      expect(reportError).not.toHaveBeenCalled()
    }
  )

  it('preserves known identities on refresh failure and recovers on retry', async () => {
    const { resolver, listCloudWorkflows } = setup(
      [workflow('workflows/current.json', 'Current')],
      [{ id: 'known', name: 'Current' }]
    )
    await resolver.refreshCloudWorkflowIds()
    const error = new Error('Unavailable')
    listCloudWorkflows.mockRejectedValueOnce(error)
    expect(await resolver.refreshCloudWorkflowIds()).toBe(false)
    expect(resolver.availableWorkflowReferences.value).toEqual([
      { id: 'known', name: 'Current' }
    ])
    expect(reportError).toHaveBeenCalledWith(error, {
      errorType: 'agent_cloud_workflow_ids_refresh_failed'
    })
    listCloudWorkflows.mockResolvedValueOnce([
      { id: 'updated', name: 'Current' }
    ])
    expect(await resolver.refreshCloudWorkflowIds()).toBe(true)
    expect(resolver.availableWorkflowReferences.value).toEqual([
      { id: 'updated', name: 'Current' }
    ])
  })
})
