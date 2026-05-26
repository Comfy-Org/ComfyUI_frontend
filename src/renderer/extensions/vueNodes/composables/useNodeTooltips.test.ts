import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SafeWidgetData } from '@/composables/graph/useGraphNodeManager'
import { te } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { Settings } from '@/schemas/apiSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import { useNodeTooltips } from './useNodeTooltips'

const jsonTooltip =
  'Positive point prompts as JSON [{"x": int, "y": int}, ...] (pixel coords)'

const positiveCoordsTooltipKey =
  'nodeDefs.SAM3_Detect.inputs.positive_coords.tooltip'

const positiveCoordsWidget: SafeWidgetData = {
  name: 'positive_coords',
  type: 'STRING'
}

const sam3DetectNodeDef: ComfyNodeDef = {
  name: 'SAM3_Detect',
  display_name: 'SAM3 Detect',
  category: 'detection/',
  python_module: 'comfy_extras.nodes_sam3',
  description: '',
  input: {
    required: {},
    optional: {
      positive_coords: [
        'STRING',
        {
          tooltip: jsonTooltip,
          forceInput: true
        }
      ]
    }
  },
  output: [],
  output_node: false,
  deprecated: false,
  experimental: false
}

describe('useNodeTooltips', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))

    vi.spyOn(useSettingStore(), 'get').mockImplementation(
      <K extends keyof Settings>(key: K): Settings[K] => {
        switch (key) {
          case 'Comfy.EnableTooltips':
            return true as Settings[K]
          case 'LiteGraph.Node.TooltipDelay':
            return 500 as Settings[K]
          default:
            return undefined as Settings[K]
        }
      }
    )

    useNodeDefStore().addNodeDef(sam3DetectNodeDef)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads JSON examples in node metadata without i18n placeholder errors', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getInputSlotTooltip } = useNodeTooltips('SAM3_Detect')

    // Ensure this exercises the bundled i18n path, not only metadata fallback.
    expect(te(positiveCoordsTooltipKey)).toBe(true)
    expect(getInputSlotTooltip('positive_coords')).toBe(jsonTooltip)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('reads input-based widget tooltips without i18n placeholder errors', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getWidgetTooltip } = useNodeTooltips('SAM3_Detect')

    expect(te(positiveCoordsTooltipKey)).toBe(true)
    expect(getWidgetTooltip(positiveCoordsWidget)).toBe(jsonTooltip)
    expect(consoleError).not.toHaveBeenCalled()
  })
})
