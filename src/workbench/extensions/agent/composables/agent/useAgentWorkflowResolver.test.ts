import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@/platform/telemetry/reportError'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { blankGraph } from '@/scripts/defaultGraph'

import type { CloudWorkflowEntry } from '../../schemas/agentApiSchema'
import { useAgentWorkflowDraftArchiveStore } from '../../stores/agent/agentWorkflowDraftArchiveStore'
import { useAgentWorkflowTabBindingStore } from '../../stores/agent/agentWorkflowTabBindingStore'

import { useAgentWorkflowResolver } from './useAgentWorkflowResolver'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

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
    },
    // Mirrors the real store: a minted tab has no change tracker until it is
    // opened, so its document id is readable only from `originalContent`.
    createNewTemporary(
      filename?: string,
      workflowData?: ComfyWorkflowJSON
    ): ComfyWorkflow {
      const name = filename ?? 'Unsaved Workflow.json'
      const created = workflow(
        `workflows/${name}`,
        name.replace(/\.json$/, ''),
        {
          isTemporary: true,
          activeState: null,
          originalContent: JSON.stringify(workflowData ?? {})
        }
      )
      this.workflows.push(created)
      return created
    }
  })
  const bindings = useAgentWorkflowTabBindingStore()
  const draftArchive = useAgentWorkflowDraftArchiveStore()
  const listCloudWorkflows = vi.fn(
    async (): Promise<CloudWorkflowEntry[]> => cloud
  )
  const resolver = useAgentWorkflowResolver({
    workflows,
    bindings,
    draftArchive,
    listCloudWorkflows
  })
  return { workflows, bindings, draftArchive, listCloudWorkflows, resolver }
}

describe('Agent workflow resolution', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingStore().settingValues['Comfy.Workflow.Persist'] = true
  })

  it('does not resolve a new temporary tab through a reused persisted path', () => {
    const { resolver, bindings, workflows } = setup([
      workflow('workflows/scratch.json', 'Scratch', { isTemporary: true })
    ])
    bindings.bind('stale-cloud-id', 'workflows/scratch.json')
    expect(resolver.cloudIdFor(workflows.openWorkflows[0])).toBeUndefined()
    expect(resolver.boundOrOpenWorkflowFor('stale-cloud-id')).toBeNull()
    expect(resolver.availableWorkflowReferences.value).toEqual([
      { tabPath: 'workflows/scratch.json', name: 'Scratch' }
    ])
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
      { id: 'old-binding', name: 'Renamed' },
      { id: 'cloud-portrait', name: 'Portrait' }
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
      { tabPath: 'workflows/scratch.json', name: 'Scratch' },
      { id: 'explicit-shared', name: 'Shared' },
      { id: 'cloud-ambiguous-1', name: 'Ambiguous' },
      { id: 'cloud-ambiguous-2', name: 'Ambiguous' },
      { id: 'cloud-scratch', name: 'Scratch' },
      { id: 'cloud-shared', name: 'Shared' }
    ])
    expect(resolver.storedWorkflowFor('cloud-shared')).toBeNull()
    expect(resolver.boundOrOpenWorkflowFor('cloud-ambiguous-1')).toBeNull()
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
    expect(resolver.boundOrOpenWorkflowFor('cloud-b')).toBeNull()
    expect(resolver.storedWorkflowFor('cloud-b')).toBe(workflows.workflows[1])
    bindings.bind('cloud-b', 'workflows/b.json')
    expect(resolver.boundOrOpenWorkflowFor('cloud-b')).toBe(
      workflows.workflows[1]
    )
    expect(resolver.openWorkflowFor('cloud-b')).toBeNull()
  })

  it('keeps editor snapshot order and consistent app reference names', async () => {
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
      { id: 'cloud-graph', name: 'Portrait' },
      { id: 'cloud-app', name: 'Portrait.app' }
    ])
    workflows.openWorkflows.reverse()
    expect(
      resolver.openTabsSnapshot()?.open_tabs?.map((tab) => tab.workflow_id)
    ).toEqual(['cloud-graph', 'cloud-app'])
    workflows.openWorkflows = []
    expect(resolver.openTabsSnapshot()).toBeUndefined()
    expect(resolver.availableWorkflowReferences.value).toEqual([
      { id: 'cloud-graph', name: 'Portrait' },
      { id: 'cloud-app', name: 'Portrait.app' }
    ])
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

  it('puts open workflows before the saved catalog and deduplicates by Cloud ID', async () => {
    const { resolver } = setup(
      [
        workflow('workflows/z.json', 'Z'),
        workflow('workflows/draft.json', 'Draft', { isTemporary: true })
      ],
      [
        { id: 'a', name: 'A' },
        { id: 'z', name: 'Z' },
        { id: 'a', name: 'A' }
      ]
    )
    await resolver.refreshCloudWorkflowIds()
    expect(resolver.availableWorkflowReferences.value).toEqual([
      { tabPath: 'workflows/draft.json', name: 'Draft' },
      { id: 'z', name: 'Z' },
      { id: 'a', name: 'A' }
    ])
    expect(resolver.openTabsSnapshot()).toEqual({
      open_tabs: [{ workflow_id: 'z', name: 'Z' }]
    })
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

  // cloudIdFor reads the name-derived index ahead of the binding store, so
  // releasing the binding alone still leaves a refused id resolvable here -
  // and refreshCloudWorkflowIds cannot be relied on to drop it, since it
  // swallows its errors and the caller races it against a timeout.
  it('stops resolving a refused cloud id once it is forgotten', async () => {
    const portrait = workflow('workflows/portrait.json', 'Portrait')
    const { resolver, bindings } = setup(
      [portrait],
      [
        { id: 'cloud-portrait', name: 'Portrait' },
        { id: 'cloud-other', name: 'Other' }
      ]
    )
    await resolver.refreshCloudWorkflowIds()
    expect(resolver.cloudIdFor(portrait)).toBe('cloud-portrait')

    bindings.unbindWorkflow('cloud-portrait')
    expect(resolver.cloudIdFor(portrait)).toBe('cloud-portrait')

    resolver.forgetCloudWorkflowId('cloud-portrait')

    expect(resolver.cloudIdFor(portrait)).toBeUndefined()
    expect(resolver.openTabsSnapshot()).toBeUndefined()
    expect(resolver.availableWorkflowReferences.value).toEqual([
      { id: 'cloud-other', name: 'Other' }
    ])
  })

  it('rejects a stale binding that points a cloud id at a differently named saved tab', async () => {
    const portrait = workflow('workflows/portrait.json', 'Portrait')
    const { resolver, bindings, workflows } = setup(
      [portrait],
      [
        { id: 'cloud-zimage', name: 'image_z_image_turbo' },
        { id: 'cloud-portrait', name: 'Portrait' }
      ]
    )
    bindings.bind('cloud-zimage', 'workflows/portrait.json')
    await resolver.refreshCloudWorkflowIds()
    expect(resolver.cloudIdFor(portrait)).toBe('cloud-portrait')
    expect(resolver.boundOrOpenWorkflowFor('cloud-zimage')).toBeNull()
    expect(resolver.storedWorkflowFor('cloud-zimage')).toBeNull()
    expect(resolver.openWorkflowFor('cloud-zimage')).toBeNull()
    expect(resolver.boundOrOpenWorkflowFor('cloud-portrait')).toBe(
      workflows.openWorkflows[0]
    )
    expect(bindings.tabPathFor('cloud-zimage')).toBeUndefined()
    expect(resolver.availableWorkflowReferences.value).toEqual([
      { id: 'cloud-portrait', name: 'Portrait' },
      { id: 'cloud-zimage', name: 'image_z_image_turbo' }
    ])
  })
})

describe('Agent unsaved workflow recovery', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingStore().settingValues['Comfy.Workflow.Persist'] = true
  })

  it('rebuilds a closed unsaved workflow from its archived graph', async () => {
    const { resolver, draftArchive, workflows } = setup([])
    const graph = { ...blankGraph, id: '11111111-2222-3333-4444-555555555555' }
    draftArchive.archive('cloud-draft', {
      filename: 'Agent draft.json',
      content: JSON.stringify(graph)
    })

    const recovered = await resolver.recoverWorkflowFor('cloud-draft')

    expect(recovered?.minted).toBe(true)
    expect(recovered?.workflow.path).toBe('workflows/Agent draft.json')
    expect(recovered?.workflow.isTemporary).toBe(true)
    expect(
      JSON.parse(recovered?.workflow.originalContent ?? 'null')
    ).toMatchObject({ id: graph.id })
    expect(workflows.getWorkflowByPath('workflows/Agent draft.json')).toEqual(
      recovered?.workflow
    )
  })

  // The thread target and a reference chip can race for the same id, and each
  // handler guards only its own generation.
  it('hands concurrent recoveries of one workflow the same tab', async () => {
    const { resolver, draftArchive, workflows } = setup([])
    draftArchive.archive('cloud-draft', {
      filename: 'Agent draft.json',
      content: JSON.stringify({
        ...blankGraph,
        id: '11111111-2222-3333-4444-555555555555'
      })
    })

    const [first, second] = await Promise.all([
      resolver.recoverWorkflowFor('cloud-draft'),
      resolver.recoverWorkflowFor('cloud-draft')
    ])

    expect(first?.minted).toBe(true)
    expect(second?.minted).toBe(false)
    expect(second?.workflow).toEqual(first?.workflow)
    expect(workflows.workflows).toHaveLength(1)
  })

  // Agent-minted tabs fall back to the same default filename every new
  // workflow gets, so the path alone cannot prove two tabs are one document.
  it('refuses to adopt an unrelated draft parked at the recovered path', async () => {
    const { resolver, draftArchive, workflows } = setup([])
    const stranger = workflows.createNewTemporary('Agent draft.json', {
      ...blankGraph,
      id: '99999999-8888-7777-6666-555555555555'
    })
    draftArchive.archive('cloud-draft', {
      filename: 'Agent draft.json',
      content: JSON.stringify({
        ...blankGraph,
        id: '11111111-2222-3333-4444-555555555555'
      })
    })

    const recovered = await resolver.recoverWorkflowFor('cloud-draft')

    expect(recovered?.minted).toBe(true)
    expect(recovered?.workflow).not.toEqual(stranger)
    expect(workflows.workflows).toHaveLength(2)
  })

  it('recovers nothing for a workflow that was never archived', async () => {
    const { resolver, workflows } = setup([])

    expect(await resolver.recoverWorkflowFor('cloud-missing')).toBeNull()
    expect(workflows.workflows).toEqual([])
  })

  it.for(['not json', '{"nodes":[]}'])(
    'discards an archived graph it cannot load back (%s)',
    async (content) => {
      const { resolver, draftArchive, workflows } = setup([])
      draftArchive.archive('cloud-broken', {
        filename: 'Agent draft.json',
        content
      })

      expect(await resolver.recoverWorkflowFor('cloud-broken')).toBeNull()
      expect(draftArchive.read('cloud-broken')).toBeNull()
      expect(workflows.workflows).toEqual([])
    }
  )
})
