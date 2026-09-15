import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'

import * as apiModule from '@/scripts/api'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { fromPartial } from '@total-typescript/shoehorn'

import { usePartnerNodesInGraph } from './usePartnerNodesInGraph'

interface FakeNode {
  type: string
  isSubgraphNode?: () => boolean
  subgraph?: { nodes: FakeNode[] }
}

const hoisted = vi.hoisted(() => ({
  rootGraph: undefined as { nodes: unknown[] } | undefined
}))

// Mirrors ComfyApp: reading `rootGraph` before init logs an error, so
// consumers must gate on `isGraphReady` instead.
vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    get rootGraph() {
      if (!hoisted.rootGraph) {
        console.error('ComfyApp graph accessed before initialization')
      }
      return hoisted.rootGraph
    },
    get isGraphReady() {
      return !!hoisted.rootGraph
    }
  }
}))

vi.mock<unknown>(import('@/scripts/api'), () => {
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

function defineNodeDef(
  name: string,
  { apiNode = false, displayName = '' } = {}
) {
  useNodeDefStore().nodeDefsByName[name] = fromPartial<ComfyNodeDefImpl>({
    name,
    display_name: displayName,
    api_node: apiNode
  })
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
    hoisted.rootGraph = undefined
  })

  afterEach(() => {
    scope.stop()
  })

  it('returns empty without touching rootGraph before the graph is ready', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { partnerNodes, hasPartnerNodes } = setup()
    expect(partnerNodes.value).toEqual([])
    expect(hasPartnerNodes.value).toBe(false)
    expect(consoleError).not.toHaveBeenCalled()

    consoleError.mockRestore()
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

  it('ignores a def that is missing the api_node field entirely', () => {
    useNodeDefStore().nodeDefsByName['MalformedDef'] =
      fromPartial<ComfyNodeDefImpl>({
        name: 'MalformedDef',
        display_name: 'Malformed'
      })
    hoisted.rootGraph = { nodes: [node('MalformedDef')] }

    const { hasPartnerNodes } = setup()

    expect(
      hasPartnerNodes.value,
      'a def without api_node must never read as a partner node'
    ).toBe(false)
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

  it('recomputes synchronously on graphChanged, not on the throttle trailing edge', () => {
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

    Object.assign(useWorkflowStore(), {
      activeWorkflow: fromPartial<ComfyWorkflow>({
        path: 'workflows/partner.json'
      })
    })
    await nextTick()

    expect(hasPartnerNodes.value).toBe(true)
  })
})
