import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import { installPartnerNodePrototype } from './installPartnerNodePrototype'
import { usePartnerNodePrototypeStore } from './partnerNodePrototypeStore'

function createNodeDef(name: string, apiNode: boolean = false): ComfyNodeDef {
  return {
    name,
    display_name: name,
    category: apiNode ? 'api/OpenAI' : 'image',
    python_module: 'test',
    description: '',
    input: {},
    output: [],
    output_is_list: [],
    output_name: [],
    output_node: false,
    deprecated: false,
    experimental: false,
    api_node: apiNode
  }
}

function activateTeamWorkspace() {
  const workspaceStore = useTeamWorkspaceStore()
  workspaceStore.workspaces = [
    {
      id: 'workspace-1',
      name: 'Acme',
      type: 'team',
      role: 'owner',
      created_at: '2026-01-01T00:00:00Z',
      joined_at: '2026-01-01T00:00:00Z',
      isSubscribed: false,
      subscriptionPlan: null,
      subscriptionTier: null,
      members: [],
      pendingInvites: []
    }
  ]
  workspaceStore.activeWorkspaceId = 'workspace-1'
}

describe('installPartnerNodePrototype', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createTestingPinia({ stubActions: false }))
    activateTeamWorkspace()
  })

  it('defaults partner nodes to hidden and reveals enabled nodes', () => {
    const nodeDefStore = useNodeDefStore()
    nodeDefStore.updateNodeDefs([
      createNodeDef('LoadImage'),
      createNodeDef('OpenAIImage', true)
    ])

    installPartnerNodePrototype()

    expect(nodeDefStore.visibleNodeDefs.map((node) => node.name)).toEqual([
      'LoadImage'
    ])

    usePartnerNodePrototypeStore().setEnabled(['OpenAIImage'], true)

    expect(nodeDefStore.visibleNodeDefs.map((node) => node.name)).toEqual([
      'LoadImage',
      'OpenAIImage'
    ])
  })

  it('does not change discovery outside an owned team workspace', () => {
    const workspaceStore = useTeamWorkspaceStore()
    const workspace = workspaceStore.workspaces[0]
    if (!workspace) throw new Error('Expected a workspace fixture')
    workspaceStore.workspaces = [{ ...workspace, role: 'member' }]

    const nodeDefStore = useNodeDefStore()
    nodeDefStore.updateNodeDefs([createNodeDef('OpenAIImage', true)])
    installPartnerNodePrototype()

    expect(nodeDefStore.visibleNodeDefs.map((node) => node.name)).toEqual([
      'OpenAIImage'
    ])
  })
})
