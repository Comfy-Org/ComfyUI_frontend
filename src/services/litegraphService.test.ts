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

  it('reactively applies policy-disabled discovery state in developer mode', async () => {
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
      expect(LiteGraph.getNodeTypesCategories()).toContain(nodeDef.category)

      governanceStore.policy = {
        enforcementEnabled: true,
        providers: [{ providerId: 'openai', enabled: false }]
      }
      await nextTick()
      expect(LiteGraph.getNodeTypesCategories()).not.toContain(nodeDef.category)

      governanceStore.policy = {
        enforcementEnabled: true,
        providers: [{ providerId: 'openai', enabled: true }]
      }
      await nextTick()
      expect(LiteGraph.getNodeTypesCategories()).toContain(nodeDef.category)
    } finally {
      LiteGraph.unregisterNodeType(nodeDef.name)
    }
  })
})
