import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'

import * as apiModule from '@/scripts/api'
import * as workflowStoreModule from '@/platform/workflow/management/stores/workflowStore'

import { usePartnerNodesInGraph } from './usePartnerNodesInGraph'

interface FakeNode {
  type: string
  isSubgraphNode?: () => boolean
  subgraph?: { nodes: FakeNode[] }
}

const hoisted = vi.hoisted(() => ({
  nodeDefsByName: {} as Record<
    string,
    { name: string; display_name: string; api_node: boolean }
  >,
  rootGraph: undefined as { nodes: unknown[] } | undefined
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({ nodeDefsByName: hoisted.nodeDefsByName })
}))

vi.mock('@/scripts/app', () => ({
  app: {
    get rootGraph() {
      return hoisted.rootGraph
    }
  }
}))

vi.mock('@/scripts/api', () => {
  const target = new EventTarget()
  return {
    api: target,
    __dispatchGraphChanged: () => {
      target.dispatchEvent(new CustomEvent('graphChanged'))
    }
  }
})

const { __dispatchGraphChanged } = apiModule as typeof apiModule & {
  __dispatchGraphChanged: () => void
}

vi.mock('@/platform/workflow/management/stores/workflowStore', async () => {
  const { ref } = await import('vue')
  const activeWorkflow = ref<{ path: string } | null>(null)
  return {
    useWorkflowStore: () => ({
      get activeWorkflow() {
        return activeWorkflow.value
      }
    }),
    __setActiveWorkflow: (workflow: { path: string } | null) => {
      activeWorkflow.value = workflow
    }
  }
})

const { __setActiveWorkflow } =
  workflowStoreModule as typeof workflowStoreModule & {
    __setActiveWorkflow: (workflow: { path: string } | null) => void
  }

function defineNodeDef(
  name: string,
  { apiNode = false, displayName = '' } = {}
) {
  hoisted.nodeDefsByName[name] = {
    name,
    display_name: displayName,
    api_node: apiNode
  }
}

function node(type: string): FakeNode {
  return { type }
}

function subgraphNode(type: string, children: FakeNode[]): FakeNode {
  return { type, isSubgraphNode: () => true, subgraph: { nodes: children } }
}

let scope: EffectScope

function setup() {
  scope = effectScope()
  return scope.run(() => usePartnerNodesInGraph())!
}

describe('usePartnerNodesInGraph', () => {
  beforeEach(() => {
    hoisted.nodeDefsByName = {}
    hoisted.rootGraph = undefined
    __setActiveWorkflow(null)
  })

  afterEach(() => {
    scope.stop()
  })

  it('returns empty when no root graph is loaded', () => {
    const { partnerNodes, hasPartnerNodes } = setup()
    expect(partnerNodes.value).toEqual([])
    expect(hasPartnerNodes.value).toBe(false)
  })

  it('collects only api_node defs, deduped, with display-name fallback', () => {
    defineNodeDef('PartnerA', { apiNode: true, displayName: 'Partner A' })
    defineNodeDef('PartnerB', { apiNode: true })
    defineNodeDef('LocalNode', { apiNode: false })
    hoisted.rootGraph = {
      nodes: [
        node('PartnerA'),
        node('PartnerA'),
        node('PartnerB'),
        node('LocalNode'),
        node('UnknownType')
      ]
    }

    const { partnerNodes } = setup()

    expect(partnerNodes.value).toEqual([
      { nodeName: 'PartnerA', displayName: 'Partner A' },
      { nodeName: 'PartnerB', displayName: 'PartnerB' }
    ])
  })

  it('finds partner nodes nested in subgraphs', () => {
    defineNodeDef('InnerPartner', { apiNode: true, displayName: 'Inner' })
    hoisted.rootGraph = {
      nodes: [
        subgraphNode('Outer', [subgraphNode('Middle', [node('InnerPartner')])])
      ]
    }

    const { hasPartnerNodes, partnerNodes } = setup()

    expect(hasPartnerNodes.value).toBe(true)
    expect(partnerNodes.value).toEqual([
      { nodeName: 'InnerPartner', displayName: 'Inner' }
    ])
  })

  it('recomputes when the graph changes', () => {
    defineNodeDef('Partner', { apiNode: true, displayName: 'Partner' })
    const nodes: FakeNode[] = []
    hoisted.rootGraph = { nodes }

    const { hasPartnerNodes } = setup()
    expect(hasPartnerNodes.value).toBe(false)

    nodes.push(node('Partner'))
    __dispatchGraphChanged()

    expect(hasPartnerNodes.value).toBe(true)
  })

  it('recomputes when the active workflow changes', async () => {
    defineNodeDef('Partner', { apiNode: true, displayName: 'Partner' })
    const nodes: FakeNode[] = []
    hoisted.rootGraph = { nodes }

    const { hasPartnerNodes } = setup()
    expect(hasPartnerNodes.value).toBe(false)

    nodes.push(node('Partner'))
    expect(hasPartnerNodes.value).toBe(false)

    __setActiveWorkflow({ path: 'workflows/partner.json' })
    await nextTick()

    expect(hasPartnerNodes.value).toBe(true)
  })
})
