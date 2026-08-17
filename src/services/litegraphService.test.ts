import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/scripts/app', () => ({
  app: { canvas: undefined },
  ComfyApp: class {}
}))

import { app } from '@/scripts/app'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { isNodeTypeDisabled } from '@/lib/litegraph/src/nodeTypeAvailability'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { usePartnerNodeGovernanceStore } from '@/platform/workspace/stores/partnerNodeGovernanceStore'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'

describe('useLitegraphService().getCanvasCenter', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('returns origin when canvas is not yet initialised', () => {
    Reflect.set(app, 'canvas', undefined)

    const center = useLitegraphService().getCanvasCenter()

    expect(center).toEqual([0, 0])
  })

  it('returns origin when canvas exists but ds.visible_area is missing', () => {
    Reflect.set(app, 'canvas', { ds: {} })

    const center = useLitegraphService().getCanvasCenter()

    expect(center).toEqual([0, 0])
  })

  it('returns the visible-area centre once the canvas is ready', () => {
    Reflect.set(app, 'canvas', {
      ds: { visible_area: [10, 20, 200, 100] }
    })

    const center = useLitegraphService().getCanvasCenter()

    expect(center).toEqual([110, 70])
  })
})

describe('useLitegraphService().registerNodeDef', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('keeps policy-disabled nodes discoverable and flags them for menus', async () => {
    const nodeDefStore = useNodeDefStore()
    const settingStore = useSettingStore()
    const governanceStore = usePartnerNodeGovernanceStore()
    governanceStore.providers = [
      {
        id: 'openai',
        displayName: 'OpenAI',
        nodeCategories: ['OpenAI']
      }
    ]
    governanceStore.policy = {
      enforcementEnabled: true,
      providers: [{ providerId: 'openai', enabled: true }]
    }
    const nodeDef: ComfyNodeDef = {
      name: 'DisabledTestNode',
      display_name: 'Disabled Test Node',
      category: '_for_testing/partner-governance/OpenAI',
      python_module: 'test',
      description: '',
      input: {},
      output: [],
      output_node: false,
      dev_only: true,
      api_node: true
    }

    settingStore.settingValues['Comfy.DevMode'] = true
    await nextTick()
    await useLitegraphService().registerNodeDef(nodeDef.name, nodeDef)
    nodeDefStore.updateNodeDefs([nodeDef])

    try {
      const nodeType = LiteGraph.registered_node_types[nodeDef.name]
      expect(LiteGraph.getNodeTypesCategories()).toContain(nodeDef.category)
      expect(isNodeTypeDisabled(nodeType)).toBe(false)

      governanceStore.policy = {
        enforcementEnabled: true,
        providers: [{ providerId: 'openai', enabled: false }]
      }
      await nextTick()
      expect(LiteGraph.getNodeTypesCategories()).toContain(nodeDef.category)
      expect(isNodeTypeDisabled(nodeType)).toBe(true)

      governanceStore.policy = {
        enforcementEnabled: true,
        providers: [{ providerId: 'openai', enabled: true }]
      }
      await nextTick()
      expect(isNodeTypeDisabled(nodeType)).toBe(false)
    } finally {
      LiteGraph.unregisterNodeType(nodeDef.name)
    }
  })

  it('rejects placing a policy-disabled node with the policy toast', async () => {
    const governanceStore = usePartnerNodeGovernanceStore()
    governanceStore.providers = [
      { id: 'openai', displayName: 'OpenAI', nodeCategories: ['OpenAI'] }
    ]
    governanceStore.policy = {
      enforcementEnabled: true,
      providers: [{ providerId: 'openai', enabled: false }]
    }
    const nodeDef: ComfyNodeDef = {
      name: 'RejectedTestNode',
      display_name: 'Rejected Test Node',
      category: '_for_testing/partner-governance/OpenAI',
      python_module: 'test',
      description: '',
      input: {},
      output: [],
      output_node: false,
      api_node: true
    }
    const service = useLitegraphService()
    const toastAdd = vi.spyOn(useToastStore(), 'add')

    const node = service.addNodeOnGraph(nodeDef)

    expect(node).toBeNull()
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warn' })
    )
  })
})
