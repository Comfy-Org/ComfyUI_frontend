import { render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import { useSelectionMenuOptions } from '@/composables/graph/useSelectionMenuOptions'
import type { MenuOption } from '@/composables/graph/menuOption'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'
import { setCanvasSelection } from '@/utils/__tests__/canvasSelectionTestUtils'
import { referenceNodesInAgent } from '@/composables/graph/referenceNodesInAgent'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

vi.mock(import('@/composables/graph/referenceNodesInAgent'), () => ({
  referenceNodesInAgent: vi.fn()
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      agent: {
        referenceInAgent: 'Reference in agent'
      },
      contextMenu: {
        Rename: 'Rename',
        Copy: 'Copy',
        Duplicate: 'Duplicate',
        Delete: 'Delete'
      },
      g: {
        frameNodes: 'Frame Nodes'
      }
    }
  },
  missingWarn: false,
  fallbackWarn: false
})

function getReferenceInAgentOption(): MenuOption | null {
  let option: MenuOption | null = null
  const Wrapper = defineComponent({
    setup() {
      option = useSelectionMenuOptions().getReferenceInAgentOption()
      return () => null
    }
  })
  render(Wrapper, { global: { plugins: [i18n] } })
  return option
}

describe('useSelectionMenuOptions.getReferenceInAgentOption', () => {
  it('is absent when the agent is unavailable', () => {
    const node = new LGraphNode('KSampler')
    node.id = toNodeId(1)
    setCanvasSelection([node])
    useAgentPanelStore().enabled = false

    expect(getReferenceInAgentOption()).toBeNull()
  })

  it('references the selected nodes from the more menu', () => {
    const node = new LGraphNode('KSampler')
    node.id = toNodeId(1)
    setCanvasSelection([node])
    useAgentPanelStore().enabled = true

    const option = getReferenceInAgentOption()
    expect(option).not.toBeNull()
    if (!option) return
    expect(option.label).toBe('Reference in agent')
    expect(option.icon).toBe('icon-[lucide--astroid]')
    option.action?.()
    expect(referenceNodesInAgent).toHaveBeenCalledExactlyOnceWith([node.id])
  })
})
