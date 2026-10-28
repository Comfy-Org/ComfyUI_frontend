import { cloneDeep } from 'es-toolkit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, mergeCustomNodesI18n } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { Settings } from '@/platform/settings/types'
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

function setTooltipsEnabled(enabled: boolean) {
  vi.spyOn(useSettingStore(), 'get').mockImplementation(
    <K extends keyof Settings>(key: K): Settings[K] =>
      (key === 'Comfy.EnableTooltips' ? enabled : undefined) as Settings[K]
  )
}

describe('useNodeTooltips', () => {
  beforeEach(() => {
    setTooltipsEnabled(true)

    useNodeDefStore().addNodeDef(sam3DetectNodeDef)
    mergeOutputTooltipMessage(jsonTooltip)
  })

  afterEach(() => {
    mergeCustomNodesI18n({})
    i18n.global.setLocaleMessage('en', cloneDeep(enMessages))
  })

  it('reads JSON examples in node metadata without i18n placeholder errors', () => {
    const { getInputSlotTooltip } = useNodeTooltips('SAM3_Detect')

    expect(getInputSlotTooltip({ name: 'positive_coords' })).toBe(jsonTooltip)
    expect(console.error).not.toHaveBeenCalled()
  })

  it('reads input-based widget tooltips without i18n placeholder errors', () => {
    const { getWidgetTooltip } = useNodeTooltips('SAM3_Detect')

    expect(getWidgetTooltip(positiveCoordsWidget)).toBe(jsonTooltip)
    expect(console.error).not.toHaveBeenCalled()
  })

  it('falls back to generic text for inputs absent from the live node definition', () => {
    const { getInputSlotTooltip, getWidgetTooltip } =
      useNodeTooltips('SAM3_Detect')

    expect(
      getInputSlotTooltip({ name: 'stale_input', localized_name: 'Stale' })
    ).toBe('Input: Stale')
    expect(getWidgetTooltip({ name: 'stale_widget' })).toBe('')
  })

  it.for([
    { enabled: true, expected: 'Full widget value' },
    { enabled: false, expected: '' }
  ])(
    'shows widget values only while tooltips are enabled ($enabled)',
    ({ enabled, expected }) => {
      setTooltipsEnabled(enabled)
      const { getWidgetTooltip } = useNodeTooltips('SAM3_Detect')

      expect(
        getWidgetTooltip({ name: 'stale_widget' }, 'Full widget value')
      ).toBe(expected)
    }
  )

  it('reads output slot tooltips without i18n placeholder errors', () => {
    const { getOutputSlotTooltip } = useNodeTooltips('SAM3_Detect')

    expect(getOutputSlotTooltip({ name: 'masks' }, 0)).toBe(jsonTooltip)
    expect(console.error).not.toHaveBeenCalled()
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
