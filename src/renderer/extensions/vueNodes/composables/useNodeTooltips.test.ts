import { cloneDeep } from 'es-toolkit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, mergeCustomNodesI18n } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { Settings } from '@/schemas/apiSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import { useNodeTooltips } from './useNodeTooltips'

const enMessages = cloneDeep(i18n.global.getLocaleMessage('en'))
const jsonTooltip =
  'Positive point prompts as JSON [{"x": int, "y": int}, ...] (pixel coords)'

const positiveCoordsWidget: { name: string; tooltip?: string } = {
  name: 'positive_coords'
}

function mergeOutputTooltipMessage(tooltip: string | null) {
  i18n.global.mergeLocaleMessage('en', {
    nodeDefs: {
      SAM3_Detect: {
        outputs: {
          0: {
            tooltip
          }
        }
      }
    }
  })
}

const sam3DetectNodeDef: ComfyNodeDef = {
  name: 'SAM3_Detect',
  display_name: 'SAM3 Detect',
  category: 'detection/',
  python_module: 'comfy_extras.nodes_sam3',
  description: 'Live SAM3 description',
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
  output: ['MASK'],
  output_name: ['masks'],
  output_tooltips: [jsonTooltip],
  output_node: false,
  deprecated: false,
  experimental: false
}

describe('useNodeTooltips', () => {
  beforeEach(() => {
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
    mergeOutputTooltipMessage(jsonTooltip)
  })

  afterEach(() => {
    mergeCustomNodesI18n({})
    i18n.global.setLocaleMessage('en', cloneDeep(enMessages))
  })

  it('reads JSON examples in node metadata without i18n placeholder errors', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getInputSlotTooltip } = useNodeTooltips('SAM3_Detect')

    expect(getInputSlotTooltip('positive_coords')).toBe(jsonTooltip)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('reads input-based widget tooltips without i18n placeholder errors', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getWidgetTooltip } = useNodeTooltips('SAM3_Detect')

    expect(getWidgetTooltip(positiveCoordsWidget)).toBe(jsonTooltip)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('reads output slot tooltips without i18n placeholder errors', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getOutputSlotTooltip } = useNodeTooltips('SAM3_Detect')

    expect(getOutputSlotTooltip(0)).toBe(jsonTooltip)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('preserves the newline separating a widget label from its long value', () => {
    const { createTooltipConfig } = useNodeTooltips('SAM3_Detect')

    const config = createTooltipConfig(`${jsonTooltip}\n\na-long-value`)

    // Without a whitespace-preserving rule the \n\n separator collapses to a
    // space and the label runs into the value (BUG-020).
    const pt = config.pt as { text?: { class?: string } } | undefined
    const textClass = pt?.text?.class ?? ''
    expect(textClass).toContain('whitespace-pre-line')
    expect(config.value).toContain('\n\n')
  })

  it('resolves descriptions for definitions added after the backend fetch', () => {
    const nodeName = 'FrontendOnlyNode'
    mergeCustomNodesI18n({
      en: {
        nodeDefs: {
          [nodeName]: { description: 'Localized frontend description' }
        }
      }
    })
    useNodeDefStore().addNodeDef({
      ...sam3DetectNodeDef,
      name: nodeName,
      description: 'Frontend description'
    })

    const { getNodeDescription } = useNodeTooltips(nodeName)

    expect(getNodeDescription.value).toBe('Localized frontend description')
  })
})
