import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import {
  showNodeOptions,
  toggleNodeOptions
} from '@/composables/graph/useMoreOptionsMenu'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  ASK_AGENT_TOOLBAR_SEEN_SETTING_ID,
  REFERENCE_IN_AGENT_MENU_SEEN_SETTING_ID
} from '@/platform/settings/constants/agent'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { toNodeId } from '@/types/nodeId'
import { setCanvasSelection } from '@/utils/__tests__/canvasSelectionTestUtils'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import NodeContextMenu from './NodeContextMenu.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en: {
      agent: {
        referenceInAgent: 'Reference in agent',
        new: 'NEW'
      }
    }
  }
})

describe('NodeContextMenu', () => {
  beforeEach(() => {
    useCanvasStore().canvas = fromPartial({
      canvas: document.createElement('canvas'),
      ds: { scale: 1, offset: [0, 0] }
    })
  })

  it('opens through the registered instance', async () => {
    render(NodeContextMenu, { global: { plugins: [i18n] } })
    const event = new PointerEvent('contextmenu', {
      bubbles: true,
      button: 2,
      clientX: 100,
      clientY: 120
    })

    showNodeOptions(event)

    expect(await screen.findByRole('menu')).toBeVisible()
  })

  it('refreshes options when toggled open', async () => {
    render(NodeContextMenu, { global: { plugins: [i18n] } })
    const event = new MouseEvent('click', {
      bubbles: true,
      clientX: 100,
      clientY: 120
    })

    toggleNodeOptions(event)

    expect(await screen.findByRole('menu')).toBeVisible()
    expect(
      screen.getByRole('menuitem', { name: 'contextMenu.Rename' })
    ).toBeVisible()
  })

  it('shows the NEW pill on Reference in agent until that item is clicked', async () => {
    const node = new LGraphNode('KSampler')
    node.id = toNodeId(1)
    setCanvasSelection([node])
    useAgentPanelStore().enabled = true
    useSettingStore().settingValues[ASK_AGENT_TOOLBAR_SEEN_SETTING_ID] = false
    useSettingStore().settingValues[REFERENCE_IN_AGENT_MENU_SEEN_SETTING_ID] =
      false
    useCanvasStore().canvas = fromPartial({
      canvas: document.createElement('canvas'),
      ds: { scale: 1, offset: [0, 0] },
      getNodeMenuOptions: () => []
    })

    render(NodeContextMenu, { global: { plugins: [i18n] } })
    const event = new MouseEvent('click', {
      bubbles: true,
      clientX: 100,
      clientY: 120
    })
    toggleNodeOptions(event)

    const item = await screen.findByRole('menuitem', {
      name: /Reference in agent/i
    })
    expect(item).toHaveTextContent('NEW')

    await userEvent.setup().click(item)
    expect(useSettingStore().get(REFERENCE_IN_AGENT_MENU_SEEN_SETTING_ID)).toBe(
      true
    )
    expect(useSettingStore().get(ASK_AGENT_TOOLBAR_SEEN_SETTING_ID)).toBe(false)
  })
})
